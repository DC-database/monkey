// v3.9 - Light theme, single top-left hamburger, overlay sidebar, auto-hide after selection.
(function(){
  const cfg = window.__FIREBASE_CONFIG__;
  const app = firebase.initializeApp(cfg);
  const db = firebase.database();
  const auth = firebase.auth();
  const statusDot = document.getElementById('statusDot');

  // Connectivity
  db.ref('.info/connected').on('value', snap => { statusDot.classList.toggle('ok', !!snap.val()); });

  // Sidebar toggles with backdrop/safe body
  const sidebar = document.getElementById('sidebar');
  const btnHamburgerTop = document.getElementById('btnHamburgerTop');
  const backdrop = document.getElementById('sidebarBackdrop');
  function syncBackdrop(){
    const isOpen = !sidebar.classList.contains('collapsed');
    if(backdrop){ backdrop.classList.toggle('show', isOpen); }
    document.body.classList.toggle('sidebar-open', isOpen);
  }
  function toggleSidebar(){ sidebar.classList.toggle('collapsed'); syncBackdrop(); }
  function hideSidebar(){ sidebar.classList.add('collapsed'); syncBackdrop(); }
  function showSidebar(){ sidebar.classList.remove('collapsed'); syncBackdrop(); }
  btnHamburgerTop.addEventListener('click', toggleSidebar);
  backdrop?.addEventListener('click', hideSidebar);
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') hideSidebar(); });
  document.querySelectorAll('.menu .menu-item').forEach(btn=> btn.addEventListener('click', hideSidebar));

  // Navigation
  const pages = document.querySelectorAll('.page');
  const menuButtons = document.querySelectorAll('.menu .menu-item[data-target]');
  function setActivePage(id){
    pages.forEach(p=>p.classList.remove('visible'));
    document.getElementById(id).classList.add('visible');
    menuButtons.forEach(b=> b.classList.toggle('active', b.dataset.target===id));
    try{ if(id==='page-collections' && typeof renderCollectionsNextMonth==='function'){ renderCollectionsNextMonth(); } }catch(e){}
  }
  setActivePage('page-search-accounts');

  // Elements common
  const adminAuthState = document.getElementById('adminAuthState');
    const btnAdminLogout = document.getElementById('btnAdminLogout');
    
  // My Account view bits
                      
  // Admin page bits
  const accId = document.getElementById('accId');
  const accName = document.getElementById('accName');
  const btnClearSelection = document.getElementById('btnClearSelection');
  const peCredit = document.getElementById('peCredit');
  const peAdditional = document.getElementById('peAdditional');
  const pePayment = document.getElementById('pePayment');
  const pePercent = document.getElementById('pePercent');
  const peDate = document.getElementById('peDate');
  const peMisc = document.getElementById('peMisc');
  const peBalance = document.getElementById('peBalance');
  const peNotes = document.getElementById('peNotes');
  const btnAddEntry = document.getElementById('btnAddEntry');
  try{ ensureDefaultDate(); }catch(e){}
  const btnUpdateEntry = document.getElementById('btnUpdateEntry');
  const btnClearEntry = document.getElementById('btnClearEntry');
  const paymentsTable = document.getElementById('paymentsTable');
  const paymentsTableBody = paymentsTable.querySelector('tbody');
  const paymentsTotals = document.getElementById('paymentsTotals');
  const statTotalAdd = document.getElementById('statTotalAdd');
  const statTotalPay = document.getElementById('statTotalPay');
  const statCurrentBal = document.getElementById('statCurrentBal');
  const statNextDate = document.getElementById('statNextDate');
  const statNextAmount = document.getElementById('statNextAmount');
  // Collections report refs
  const collectionsTableBody = document.getElementById('collectionsTableBody');

  // User search UI
  const userSearchInput = document.getElementById('userSearchInput');
  const userSearchResults = document.getElementById('userSearchResults');
  const btnClearUserSearch = document.getElementById('btnClearUserSearch');

  // Users CRUD
  const uAccId = document.getElementById('uAccId');
  const uAccName = document.getElementById('uAccName');
  const uRole = document.getElementById('uRole');
  const uEmail = document.getElementById('uEmail');
  const uMobile = document.getElementById('uMobile');
  const uPassword = document.getElementById('uPassword');
  const btnAddUser = document.getElementById('btnAddUser');
  const btnUpdateUser = document.getElementById('btnUpdateUser');
  const btnClearUser = document.getElementById('btnClearUser');
  const usersTableBody = document.querySelector('#usersTable tbody');

  // DB refs
  const refs = { accounts: db.ref('accounts'), users: db.ref('users') };

  // State
  let selectedPaymentKey = null;
  let usersCache = null;

  // Utils
  const CURRENCY = 'QAR';
  const fmt = new Intl.NumberFormat(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
  const fmtQAR = new Intl.NumberFormat(undefined, {style:'currency', currency:CURRENCY, minimumFractionDigits:2});
  const money = (v)=> fmt.format(Number.isFinite(+v) ? (+v) : 0);
  const moneyQ = (v)=> fmtQAR.format(Number.isFinite(+v) ? (+v) : 0);
  const toNum = (x)=>{ if(typeof x==='number') return x||0; if(x==null) return 0; const s=String(x).replace(/[,\s]/g,''); const n=parseFloat(s); return Number.isFinite(n)?n:0; };
  const id = (len=20)=> Array.from(crypto.getRandomValues(new Uint8Array(len))).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,len);
  const debounce = (fn, ms=250)=>{ let t=null; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; };

  
  function formatISODate(d=new Date()){
    try{
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');
      return `${yyyy}-${mm}-${dd}`;
    }catch(e){ return ''; }
  }
  function parseYMDMMMDDD(str){
    try{
      const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
      const m = String(str||'').match(/^(\d{4})-([A-Za-z]{3})-(\d{2})-/);
      if(!m) return null;
      const y = +m[1], mon = months[m[2]], day = +m[3];
      if(mon==null) return null;
      return new Date(y, mon, day);
    }catch(e){ return null; }
  }
  function ensureDefaultDate(){
    try{
      if (peDate){
        const v = String(peDate.value||'');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(v)) peDate.value = formatISODate(new Date());
      }
    }catch(e){}
  }

function addMonths(d, months){ try{ return new Date(d.getFullYear(), d.getMonth()+months, d.getDate()); }catch(e){ return d; } }

function formatYMDWeek(d=new Date()){
    try{
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const yyyy = d.getFullYear();
      const mmm = months[d.getMonth()];
      const dd = String(d.getDate()).padStart(2,'0');
      const ddd = days[d.getDay()];
      return `${yyyy}-${mmm}-${dd}-${ddd}`;
    }catch(e){ return ''; }
  }


  /* ================= MODALS ================= */
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalAdmin = document.getElementById('modalAdmin');
  if (modalBackdrop) modalBackdrop.hidden = true;
  if (modalAdmin) modalAdmin.hidden = true;
  function openModal(el){ if(modalBackdrop) modalBackdrop.hidden=false; if(el) el.hidden=false; hideSidebar(); }
  function closeModal(el){ if(el) el.hidden=true; if(modalAdmin && modalAdmin.hidden && modalBackdrop) modalBackdrop.hidden=true; }
  document.querySelectorAll('.modal-close').forEach(btn=>{
    btn.addEventListener('click', (e)=>{ const id = e.currentTarget.getAttribute('data-close'); if(id){ const el = document.getElementById(id); if(el) closeModal(el); } });
  });
  if (modalBackdrop) modalBackdrop.addEventListener('click', ()=>{ if(modalAdmin) modalAdmin.hidden=true; if(modalBackdrop) modalBackdrop.hidden=true; });

  /* ================= ADMIN (Firebase Auth) ================= */
  const btnDoAdminLogin = document.getElementById('btnDoAdminLogin');
  const btnAdminCreate = document.getElementById('btnAdminCreate');
  const btnAdminForgot = document.getElementById('btnAdminForgot');
  const adminEmail = document.getElementById('adminEmail');
  const adminPassword = document.getElementById('adminPassword');
  const adminLoginMsg = document.getElementById('adminLoginMsg');

  function requireAdminOrModal(targetPageId){
    if(!auth.currentUser){
      openModal(modalAdmin);
      modalAdmin.dataset.nextPage = targetPageId;
      return false;
    }
    return true;
  }
  document.getElementById('menuAdminPayments').addEventListener('click', ()=>{
    if(requireAdminOrModal('page-admin-payments')) setActivePage('page-admin-payments');
    hideSidebar();
  });
  document.getElementById('menuAdminUsers').addEventListener('click', ()=>{
    if(requireAdminOrModal('page-admin-users')) setActivePage('page-admin-users');
    hideSidebar();
  });
  document.getElementById('menuAdminCollections').addEventListener('click', ()=>{
    if(requireAdminOrModal('page-collections')){ setActivePage('page-collections'); renderCollectionsNextMonth(); }
    hideSidebar();
  });
  
  document.getElementById('menuSearchAccounts').addEventListener('click', ()=>{
    setActivePage('page-search-accounts'); hideSidebar();
  });

  document.getElementById('menuSettings').addEventListener('click', ()=>{ setActivePage('page-settings'); hideSidebar(); });
  // Bottom tab bar routing

  const tab = id=>document.getElementById(id);
  const activateTab = (id)=>{ document.querySelectorAll('#tabbar .tab').forEach(b=>b.classList.remove('active')); const el = document.getElementById(id); if(el) el.classList.add('active'); };
  tab('tabSearch')?.addEventListener('click', ()=>{ setActivePage('page-search-accounts'); activateTab('tabSearch'); });
  tab('tabPayments')?.addEventListener('click', ()=>{ if(requireAdminOrModal('page-admin-payments')){ setActivePage('page-admin-payments'); activateTab('tabPayments'); } });
  tab('tabUsers')?.addEventListener('click', ()=>{ if(requireAdminOrModal('page-admin-users')){ setActivePage('page-admin-users'); activateTab('tabUsers'); } });
  tab('tabSettings')?.addEventListener('click', ()=>{ setActivePage('page-settings'); activateTab('tabSettings'); });
  // default active tab
  activateTab('tabSearch');

  
// === Bottom tabbar: robust attach on DOM ready ===
(function(){
  function install(){
    if (window.__tabbarDelegated) return true;
    const tabbar = document.getElementById('tabbar');
    if (!tabbar) return false;
    window.__tabbarDelegated = true;

    const activateTab = (id)=>{
      try{
        document.querySelectorAll('#tabbar .tab').forEach(b=>b.classList.remove('active'));
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
      }catch(e){}
    };

    const handle = (evt)=>{
      const btn = evt.target && evt.target.closest ? evt.target.closest('button.tab') : null;
      if (!btn) return;
      evt.preventDefault();
      const target = btn.getAttribute('data-target');
      // Fallback targets by id
      const idMap = {
        'tabSearch': 'page-search-accounts',
        'tabPayments': 'page-admin-payments',
        'tabUsers': 'page-admin-users',
        'tabSettings': 'page-settings'
      };
      const goto = target || idMap[btn.id];
      if (!goto) return;

      if (goto === 'page-admin-payments' || goto === 'page-admin-users'){
        if (!requireAdminOrModal(goto)) return;
      }
      setActivePage(goto);
      activateTab(btn.id);
    };

    tabbar.addEventListener('click', handle, {passive:false});
    tabbar.addEventListener('touchstart', handle, {passive:false});

    // Also attach direct listeners if buttons exist (for redundancy)
    const tab = id=>document.getElementById(id);
    tab('tabSearch')?.addEventListener('click', ()=>{ setActivePage('page-search-accounts'); activateTab('tabSearch'); });
    tab('tabPayments')?.addEventListener('click', ()=>{ if(requireAdminOrModal('page-admin-payments')){ setActivePage('page-admin-payments'); activateTab('tabPayments'); } });
    tab('tabUsers')?.addEventListener('click', ()=>{ if(requireAdminOrModal('page-admin-users')){ setActivePage('page-admin-users'); activateTab('tabUsers'); } });
    tab('tabSettings')?.addEventListener('click', ()=>{ setActivePage('page-settings'); activateTab('tabSettings'); });

    return true;
  }

  if (!install()){
    const ready = ()=>{ if (!install()) setTimeout(ready, 80); };
    if (document.readyState === 'loading'){
document.addEventListener('DOMContentLoaded', ready, {once:true});
      window.addEventListener('load', ready, {once:true});
    } else {
      ready();
    }
  }
})();
function updateAdminState(){
    const isIn = !!auth.currentUser;
    adminAuthState.textContent = isIn ? 'Signed in' : 'Signed out';
    adminAuthState.classList.toggle('ok', isIn);
    adminAuthState.classList.toggle('danger', !isIn);
    if(isIn){ refreshUsersTable(); if(accId.value) refreshPaymentsTable(); }
  }
  auth.onAuthStateChanged(updateAdminState);

  btnDoAdminLogin.addEventListener('click', ()=>{
    adminLoginMsg.textContent = 'Signing in...';
    auth.signInWithEmailAndPassword(adminEmail.value.trim(), adminPassword.value.trim())
      .then(()=>{
        adminLoginMsg.textContent = 'Success.';
        const next = modalAdmin.dataset.nextPage || 'page-admin-payments';
        modalAdmin.dataset.nextPage = '';
        closeModal(modalAdmin);
        setActivePage(next);
        hideSidebar();
      })
      .catch(err=> adminLoginMsg.textContent = 'Error: '+err.message);
  });
  if(btnAdminCreate){ btnAdminCreate.addEventListener('click', ()=>{
    adminLoginMsg.textContent = 'Creating...';
    auth.createUserWithEmailAndPassword(adminEmail.value.trim(), adminPassword.value.trim())
      .then(()=> adminLoginMsg.textContent = 'Admin created. Now signed in.')
      .catch(err=> adminLoginMsg.textContent = 'Error: '+err.message);
  }); }
  if(btnAdminForgot){ btnAdminForgot.addEventListener('click', ()=>{
    const email = adminEmail.value.trim();
    if(!email) return adminLoginMsg.textContent='Enter email first.';
    auth.sendPasswordResetEmail(email)
      .then(()=> adminLoginMsg.textContent='Password reset email sent.')
      .catch(err=> adminLoginMsg.textContent='Error: '+err.message);
  }); }
  btnAdminLogout.addEventListener('click', ()=> auth.signOut());

  /* ================= Accounts / Payments CRUD ================= */
  function getEntriesOnce(accountKey){
    return refs.accounts.child(accountKey).child('entries').once('value').then(s=> s.val()||{});
  }

  
function renderPaymentsTable(entries){
    paymentsTableBody.innerHTML = '';
    const arr = Object.entries(entries || {}).map(([k,v])=>({k, ...v})).sort((a,b)=> (a.ts||0)-(b.ts||0));
    if(arr.length===0){
      paymentsTableBody.innerHTML='<tr><td colspan="8">No entries yet.</td></tr>';
      paymentsTotals.innerHTML='<td>Σ</td><td>–</td><td>0.00</td><td>0.00</td><td>0.00</td><td>–</td><td></td><td></td>';
          // Reset stat cards on Clear All
    try { statTotalAdd.textContent = moneyQ(0); statTotalPay.textContent = moneyQ(0); statCurrentBal.textContent = moneyQ(0); if (statNextDate) statNextDate.textContent='—'; if (statNextAmount) statNextAmount.textContent = moneyQ(0); } catch(e) {}
return;
    }
    let idx=1;
    let sum = { add:0, pay:0, misc:0 };
    arr.forEach(v=>{
      const credit = ('credit' in v) ? v.credit : (v.initial || 0);
      const bal = (('balance' in v && v.balance!==undefined) ? v.balance : (toNum(credit) + toNum(v.additional||0) - toNum(v.payment||0)));
      const tr = document.createElement('tr');
      tr.dataset.key = v.k;
      tr.innerHTML = `
        <td>${idx++}</td>
        <td>${money(credit||0)}</td>
        <td>${money(v.additional||0)}</td>
        <td>${money(v.payment||0)}</td>
        <td>${money(v.misc||0)}</td>
        <td>${money(bal)}</td>
        <td>${(v.notes||'')}</td>
        <td><button class="danger btnDelete">Delete</button></td>`;
      paymentsTableBody.appendChild(tr);
      sum.add += toNum(v.additional||0);
      sum.pay += toNum(v.payment||0);
      sum.misc += toNum(v.misc||0);
    });
    paymentsTotals.innerHTML = `<td>Σ</td><td>–</td><td>${money(sum.add)}</td><td>${money(sum.pay)}</td><td>${money(sum.misc)}</td><td>–</td><td></td><td></td>`;
    // Update stat cards for Admin
    try {
      if (statTotalAdd && statTotalPay && statCurrentBal) {
        const last = arr.length ? arr[arr.length-1] : null;
        const lastBal = last ? (('balance' in last && last.balance!==undefined) ? last.balance : (toNum(('credit' in last)?last.credit:(last.initial||0)) + toNum(last.additional||0) - toNum(last.payment||0))) : 0;
        statTotalAdd.textContent = moneyQ((function(){ const first = arr.length ? arr[0] : null; const firstCredit = first ? toNum(('credit' in first) ? first.credit : (first.initial || 0)) : 0; return firstCredit + (sum.add || 0); })());
        statTotalPay.textContent = moneyQ(sum.pay || 0);
        statCurrentBal.textContent = moneyQ(lastBal || 0);
      }
    } catch(e) {}
    
    // Next Collection Date & Collection Amount
    try{
      if (Array.isArray(arr) && arr.length){
        const last = arr[arr.length-1];
        // Base = last payment date (preferred), else ts, else today
        let baseDate = null;
        if (last.date) baseDate = parseYMDMMMDDD(last.date);
        if (!baseDate && last.ts) baseDate = new Date(last.ts);
        if (!baseDate) baseDate = new Date();
        const nextDate = addMonths(baseDate, 1);
        if (statNextDate) statNextDate.textContent = formatYMDWeek(nextDate);

        // Collection Amount = credit x previous percent
        const credit = toNum(('credit' in last) ? last.credit : (last.initial || 0));
        let prevPct = ('percent' in last) ? toNum(last.percent) : 0;
        if (!prevPct && credit) {
          const lastPay = toNum(last.payment || 0);
          prevPct = lastPay ? (lastPay / credit) * 100 : 0;
        }
        const collAmt = credit * (prevPct/100);
        if (statNextAmount) statNextAmount.textContent = moneyQ(collAmt);
      } else {
        if (statNextDate) statNextDate.textContent = '—';
        if (statNextAmount) statNextAmount.textContent = moneyQ(0);
      }
    }catch(e){}// after render, set default credit
    setCreditDefaultForAdd(arr);
  }

function refreshPaymentsTable(){
}

  function refreshPaymentsTable(){
    const key = accId.value.trim();
    if(!key){ paymentsTableBody.innerHTML='<tr><td colspan="8">Select an account via User Search.</td></tr>'; paymentsTotals.innerHTML='<td>Σ</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td></td><td></td>'; try { statTotalAdd.textContent = moneyQ(0); statTotalPay.textContent = moneyQ(0); statCurrentBal.textContent = moneyQ(0); if (statNextDate) statNextDate.textContent='—'; if (statNextAmount) statNextAmount.textContent = moneyQ(0); } catch(e) {}
    return; }
    getEntriesOnce(key).then(renderPaymentsTable);
  }

  function setCreditDefaultForAdd(sortedArr){
    const key = accId.value.trim();
    function apply(balance, readOnly){
      peCredit.readOnly = !!readOnly;
      peCredit.value = balance ? (+balance).toFixed(2) : '';
      peCredit.placeholder = readOnly ? 'auto from previous balance' : 'first entry only';
      recalcBalance();
    }
    if(!key){ apply('', false); return; }
    if(sortedArr && sortedArr.length){
      const last = sortedArr[sortedArr.length-1];
      apply(last.balance || 0, true);
    }else{
      getEntriesOnce(key).then(entries=>{
        const arr = Object.entries(entries).map(([k,v])=>({k,...v})).sort((a,b)=> (a.ts||0)-(b.ts||0));
        if(arr.length){
          const last = arr[arr.length-1];
          apply(last.balance || 0, true);
        }else{
          apply('', false);
        }
      });
    }
  }

  
  function recalcPaymentFromPercent(){
    if(!pePercent) return;
    const pct = toNum(pePercent.value);
    const credit = toNum(peCredit.value);
    if(Number.isFinite(pct) && Number.isFinite(credit)){
      const pay = (credit * pct) / 100;
      pePayment.value = (Number.isFinite(pay)?pay:0).toFixed(2);
    }
    recalcBalance();
  }

  function recalcBalance(){
    const credit = toNum(peCredit.value);
    const add = toNum(peAdditional.value);
    const pay = toNum(pePayment.value);
    const bal = credit + add - pay;
    peBalance.value = (Number.isFinite(bal)?bal:0).toFixed(2);
  }

  ['input','change'].forEach(evt => {
    [peCredit, peAdditional, pePayment].forEach(el => el.addEventListener(evt, recalcBalance));
  });

  // Update payment when percent or credit changes
  ;['input','change'].forEach(evt => {
    if (pePercent) pePercent.addEventListener(evt, recalcPaymentFromPercent);
    if (peCredit) peCredit.addEventListener(evt, recalcPaymentFromPercent);
  });

  if (btnClearSelection) btnClearSelection.addEventListener('click', ()=>{
    accId.value='';
    accName.value='';
    paymentsTableBody.innerHTML='<tr><td colspan="8">Select an account via User Search.</td></tr>';
    paymentsTotals.innerHTML='<td>Σ</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td></td><td></td>';
    peCredit.value=''; peCredit.readOnly=false; peCredit.placeholder='first entry only';
    [peAdditional, pePayment, peMisc, peBalance, peNotes].forEach(i=> i.value=''); if (pePercent) pePercent.value=''; if (peDate) { peDate.value=''; ensureDefaultDate(); } if (pePercent) pePercent.value=''; if (peDate) { peDate.value=''; ensureDefaultDate(); } if (pePercent) pePercent.value=''; if (peDate) { peDate.value=''; ensureDefaultDate(); }
    selectedPaymentKey=null; btnUpdateEntry.disabled=true;
  });

  function clearPaymentForm(){
    [peAdditional, pePayment, peMisc, peBalance, peNotes].forEach(i=> i.value=''); if (pePercent) pePercent.value=''; if (peDate) { peDate.value=''; ensureDefaultDate(); } if (pePercent) pePercent.value=''; if (peDate) { peDate.value=''; ensureDefaultDate(); } if (pePercent) pePercent.value=''; if (peDate) { peDate.value=''; ensureDefaultDate(); }
    selectedPaymentKey = null;
    btnUpdateEntry.disabled = true;
    Array.from(paymentsTableBody.querySelectorAll('tr')).forEach(tr=>tr.classList.remove('active'));
    refreshPaymentsTable(); // will reset credit default
  }

  function clearAllSelectionAndForm(){
    // Clear selected account
    accId.value='';
    accName.value='';
    // Reset payments table & totals to default message
    paymentsTableBody.innerHTML='<tr><td colspan="8">Select an account via User Search.</td></tr>';
    paymentsTotals.innerHTML='<td>Σ</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td></td><td></td>';
        try { statTotalAdd.textContent = moneyQ(0); statTotalPay.textContent = moneyQ(0); statCurrentBal.textContent = moneyQ(0); if (statNextDate) statNextDate.textContent='—'; if (statNextAmount) statNextAmount.textContent = moneyQ(0); } catch(e) {}
    // Reset form fields & credit field to editable
    peCredit.value=''; peCredit.readOnly=false; peCredit.placeholder='first entry only';
    [peAdditional, pePayment, peMisc, peBalance, peNotes].forEach(i=> i.value=''); if (pePercent) pePercent.value=''; if (peDate) { peDate.value=''; ensureDefaultDate(); } if (pePercent) pePercent.value=''; if (peDate) { peDate.value=''; ensureDefaultDate(); } if (pePercent) pePercent.value=''; if (peDate) { peDate.value=''; ensureDefaultDate(); }
    selectedPaymentKey=null; btnUpdateEntry.disabled=true;
    // Also clear any user search UI rows so we are "back to Step 1"
    if (userSearchResults) userSearchResults.innerHTML='';
    if (userSearchInput) { try { userSearchInput.focus(); } catch(e){} }
  }

  // Step 3 'Clear All' now resets selection & table and focuses Step 1 search
  btnClearEntry.addEventListener('click', ()=>{ clearAllSelectionAndForm(); setActivePage('page-admin-payments'); });

  btnAddEntry.addEventListener('click', ()=>{
    if(!auth.currentUser){ openModal(modalAdmin); modalAdmin.dataset.nextPage='page-admin-payments'; return; }
    const key = accId.value.trim();
    if(!key) return alert('Pick an account via User Search first');
    if(!peBalance.value) recalcBalance();
    ensureDefaultDate();
    const payload = {
      credit: +(peCredit.value||0),
      additional: +(peAdditional.value||0),
      payment: +(pePayment.value||0),
      misc: +(peMisc.value||0),
      balance: +(peBalance.value||0),
      percent: +(pePercent ? (pePercent.value||0) : 0),
      date: (peDate && peDate.value) ? formatYMDWeek(new Date(peDate.value)) : formatYMDWeek(new Date()),
      notes: peNotes.value||'',
      ts: Date.now(),
      initial: +(peCredit.value||0) // legacy
    };
    db.ref('accounts/'+key+'/entries/'+id(16)).set(payload);
    clearPaymentForm();
  });

  btnUpdateEntry.addEventListener('click', ()=>{
    if(!auth.currentUser){ openModal(modalAdmin); modalAdmin.dataset.nextPage='page-admin-payments'; return; }
    const key = accId.value.trim();
    if(!key || !selectedPaymentKey) return;
    if(!peBalance.value) recalcBalance();
    ensureDefaultDate();
    ensureDefaultDate();
    const payload = {
      credit: +(peCredit.value||0),
      additional: +(peAdditional.value||0),
      payment: +(pePayment.value||0),
      misc: +(peMisc.value||0),
      balance: +(peBalance.value||0),
      percent: +(pePercent ? (pePercent.value||0) : 0),
      date: (peDate && peDate.value) ? formatYMDWeek(new Date(peDate.value)) : formatYMDWeek(new Date()),
      notes: peNotes.value||'',
      ts: Date.now(),
      initial: +(peCredit.value||0) // legacy
    };
    db.ref('accounts/'+key+'/entries/'+selectedPaymentKey).update(payload);
    clearPaymentForm();
  });

  paymentsTableBody.addEventListener('click', (e)=>{
    const tr = e.target.closest('tr');
    if(!tr || !tr.dataset.key) return;
    const key = accId.value.trim();
    const rowKey = tr.dataset.key;
    if(e.target.classList.contains('btnDelete')){
      if(!auth.currentUser){ openModal(modalAdmin); modalAdmin.dataset.nextPage='page-admin-payments'; return; }
      if(confirm('Delete this entry?')){
        refs.accounts.child(key).child('entries').child(rowKey).remove();
        refreshPaymentsTable();
      }
      return;
    }
    // Row click = load into form for editing
    refs.accounts.child(key).child('entries').child(rowKey).once('value').then(s=>{
      const v = s.val()||{};
      const credit = ('credit' in v) ? v.credit : (v.initial || 0);
      peCredit.value = (toNum(credit||0)).toFixed(2);
      peCredit.readOnly = true; // keep credit locked to maintain history logic
      peCredit.placeholder = 'credit locked (from history)';
      peAdditional.value = v.additional || '';
      pePayment.value = v.payment || '';
      peMisc.value = v.misc || '';
      peBalance.value = money(v.balance||0);
      peNotes.value = v.notes || '';
      if (pePercent) pePercent.value = (('percent' in v) ? v.percent : (toNum(v.payment||0) && toNum(credit||0) ? ((toNum(v.payment)/toNum(credit))*100).toFixed(2) : ''));
      if (peDate){ let dt=null; if (v.date) dt = parseYMDMMMDDD(v.date); if(!dt && v.ts) dt = new Date(v.ts); if(!dt) dt = new Date(); peDate.value = formatISODate(dt); }
      selectedPaymentKey = rowKey;
      btnUpdateEntry.disabled = false;
      Array.from(paymentsTableBody.querySelectorAll('tr')).forEach(x=>x.classList.remove('active'));
      tr.classList.add('active');
      setActivePage('page-admin-payments');
    });
  });

  
  // === Collections Report (Next Month) ===
  function computeNextFromLastEntry(last){
    // Base date from 'date' (YYYY-MMM-DD-DDD) else from 'ts'
    let baseDate = null;
    if (last && last.date) baseDate = parseYMDMMMDDD(last.date);
    if (!baseDate && last && last.ts) baseDate = new Date(last.ts);
    if (!baseDate) baseDate = new Date();
    const nextDate = addMonths(baseDate, 1);
    // Amount = credit * previous percent
    const credit = toNum(('credit' in last) ? last.credit : (last?.initial || 0));
    let pct = ('percent' in (last||{})) ? toNum(last.percent) : 0;
    if (!pct && credit){ const pay = toNum(last?.payment || 0); pct = pay ? (pay/credit)*100 : 0; }
    const amount = credit * (pct/100);
    return { nextDate, amount };
  }
  function renderCollectionsNextMonth(){
    if (!collectionsTableBody) return;
    collectionsTableBody.innerHTML = '<tr><td colspan="5">Loading…</td></tr>';
    // Determine "next month" window
    const now = new Date();
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth()+1, 1);
    const nextMonthEnd   = new Date(now.getFullYear(), now.getMonth()+2, 1);
    const inNextMonth = (d)=> d >= nextMonthStart && d < nextMonthEnd;

    refs.accounts.once('value').then(s=>{
      const accs = s.val() || {};
      const rows = [];
      Object.entries(accs).forEach(([accKey, acc])=>{
        const entries = (acc && acc.entries) || {};
        const arr = Object.entries(entries).map(([k,v])=>({k,...v})).sort((a,b)=> (a.ts||0) - (b.ts||0));
        if (!arr.length) return;
        const last = arr[arr.length-1];
        const { nextDate, amount } = computeNextFromLastEntry(last);
        if (inNextMonth(nextDate)){
          rows.push({ account: accKey, name: (acc && acc.name) || accKey, amount, date: nextDate });
        }
      });
      rows.sort((a,b)=> a.date - b.date || String(a.account).localeCompare(String(b.account)));
      if (!rows.length){
        collectionsTableBody.innerHTML = '<tr><td colspan="5">No collections scheduled for next month.</td></tr>';
        return;
      }
      collectionsTableBody.innerHTML = '';
      let i = 1;
      rows.forEach(r=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i++}</td><td>${r.account}</td><td>${r.name}</td><td>${moneyQ(r.amount||0)}</td><td>${formatYMDWeek(r.date)}</td>`;
        collectionsTableBody.appendChild(tr);
      });
    });
  }
/* ================= User Search (from /users) ================= */
  function loadUsersOnce(){
    if(usersCache) return Promise.resolve(usersCache);
    return refs.users.once('value').then(s=>{
      usersCache = s.val() || {};
      return usersCache;
    });
  }

  function ensureAccountExists(accountId, accountName){
    if(!accountId) return Promise.resolve();
    return refs.accounts.child(accountId).once('value').then(s=>{
      if(!s.exists()){
        return refs.accounts.child(accountId).set({ accountId, name: accountName || accountId });
      }
    });
  }

  function renderUserResults(list){
    userSearchResults.innerHTML = '';
    if(!list.length){
      userSearchResults.innerHTML = '<div class="row"><div>No users found.</div></div>';
      return;
    }
    list.forEach(({key, u})=>{
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div>
          <div><strong>${(u.accountName||'')}</strong> <span class="badge">${u.role||'user'}</span></div>
          <div class="meta">${(u.accountId||'')}</div>
        </div>
        <div class="meta">${(u.email||'')}</div>
      `;
      row.addEventListener('click', ()=>{
        if(!auth.currentUser){ openModal(modalAdmin); modalAdmin.dataset.nextPage='page-admin-payments'; return; }
        const acctId = u.accountId;
        const acctName = u.accountName;
        ensureAccountExists(acctId, acctName).then(()=>{
          accId.value = acctId;
          accName.value = acctName || '';
          refreshPaymentsTable();
          setActivePage('page-admin-payments');
          hideSidebar();
        });
      });
      userSearchResults.appendChild(row);
    });
  }

  const handleUserSearch = debounce(()=>{
    const q = (userSearchInput.value||'').trim().toLowerCase();
    if(!q){ userSearchResults.innerHTML = ''; return; }
    loadUsersOnce().then(users=>{
      const arr = Object.entries(users).map(([key,u])=>({key,u}));
      const filt = arr.filter(({u})=>{
        const hay = [(u.accountId||''),(u.accountName||''),(u.email||'')].join(' ').toLowerCase();
        return hay.includes(q);
      }).slice(0, 25);
      renderUserResults(filt);
    });
  }, 200);

  userSearchInput.addEventListener('input', handleUserSearch);
  btnClearUserSearch.addEventListener('click', ()=>{ userSearchInput.value=''; userSearchResults.innerHTML=''; });

  /* ================= Users CRUD (gated) ================= */
  function clearUserForm(){
    [uAccId,uAccName,uRole,uEmail,uMobile,uPassword].forEach(i=> i.value = (i===uRole ? 'user' : ''));
    btnUpdateUser.disabled = true;
    Array.from(usersTableBody.querySelectorAll('tr')).forEach(tr=>tr.classList.remove('active'));
  }
  btnClearUser.addEventListener('click', clearUserForm);

  function refreshUsersTable(){
    refs.users.once('value').then(s=>{
      const data = s.val()||{};
      usersTableBody.innerHTML='';
      let i=1;
      Object.entries(data).forEach(([k,v])=>{
        const tr = document.createElement('tr');
        tr.dataset.key = k;
        tr.innerHTML = `<td>${i++}</td><td>${v.accountId||''}</td><td>${v.accountName||''}</td><td>${v.role||''}</td><td>${v.email||''}</td><td>${v.mobile||''}</td><td>${v.password||''}</td><td><button class="ghost btnEditUser">Edit</button><button class="danger btnDeleteUser">Delete</button></td>`;
        usersTableBody.appendChild(tr);
      });
      if(i===1) usersTableBody.innerHTML='<tr><td colspan="8">No users yet.</td></tr>';
    });
  }
  usersTableBody.addEventListener('click', (e)=>{
    if(!auth.currentUser){ openModal(modalAdmin); modalAdmin.dataset.nextPage='page-admin-users'; return; }
    const tr = e.target.closest('tr');
    if(!tr || !tr.dataset.key) return;
    const rowKey = tr.dataset.key;
    if(e.target.classList.contains('btnEditUser')){
      refs.users.child(rowKey).once('value').then(s=>{
        const v = s.val()||{};
        uAccId.value = v.accountId||'';
        uAccName.value = v.accountName||'';
        uRole.value = v.role||'user';
        uEmail.value = v.email||'';
        uMobile.value = v.mobile||'';
        uPassword.value = v.password||'';
        btnUpdateUser.disabled = false;
        Array.from(usersTableBody.querySelectorAll('tr')).forEach(x=>x.classList.remove('active'));
        tr.classList.add('active');
        setActivePage('page-admin-users');
        hideSidebar();
      });
    }else if(e.target.classList.contains('btnDeleteUser')){
      if(confirm('Delete this user?')){
        refs.users.child(rowKey).remove();
        refreshUsersTable();
      }
    }
  });
  btnAddUser.addEventListener('click', ()=>{
    if(!auth.currentUser){ openModal(modalAdmin); modalAdmin.dataset.nextPage='page-admin-users'; return; }
    ensureDefaultDate();
    ensureDefaultDate();
    const payload = { accountId: uAccId.value.trim(), accountName: uAccName.value.trim(), role: (uRole.value||'user'), email: uEmail.value.trim(), mobile: uMobile.value.trim(), password: uPassword.value.trim() };
    if(!payload.accountId || !payload.accountName) return alert('Account ID & Name required');
    refs.users.child(id(16)).set(payload);
    clearUserForm();
    refreshUsersTable();
  });
  btnUpdateUser.addEventListener('click', ()=>{
    alert('Use the table Edit button to load a user, then update and resave by custom logic if needed.');
  });

  // Init: sidebar collapsed; content full width
  sidebar.classList.add('collapsed');

  /* ================= SEARCH ACCOUNTS (read-only) ================= */
  const accSearchInput = document.getElementById('accSearchInput');
  const accSearchResults = document.getElementById('accSearchResults');
  const btnClearAccSearch = document.getElementById('btnClearAccSearch');
  const sAccId = document.getElementById('sAccId');
  const sAccName = document.getElementById('sAccName');
  const searchPaymentsTableBody = document.querySelector('#searchPaymentsTable tbody');
  const searchPaymentsTotals = document.getElementById('searchPaymentsTotals');

  function renderSearchPaymentsTable(entries){
    searchPaymentsTableBody.innerHTML = '';
    const arr = Object.entries(entries || {}).map(([k,v])=>({k, ...v})).sort((a,b)=> (a.ts||0)-(b.ts||0));
    if(arr.length===0){
      searchPaymentsTableBody.innerHTML='<tr><td colspan="9">No entries yet.</td></tr>';
      searchPaymentsTotals.innerHTML='<td>Σ</td><td>–</td><td>0.00</td><td>0.00</td><td>0.00</td><td>–</td><td>–</td><td></td><td></td>';
      return;
    }
    let i=1; let sum={add:0, pay:0, misc:0};
    arr.forEach(v=>{
      const credit = ('credit' in v) ? v.credit : (v.initial || 0);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i++}</td><td>${money(credit||0)}</td><td>${money(v.additional||0)}</td><td>${money(v.payment||0)}</td><td>${money(v.misc||0)}</td><td>${money(('balance' in v && v.balance!==undefined) ? v.balance : ((credit + toNum(v.additional||0) + toNum(v.misc||0)) - toNum(v.payment||0)))}</td><td>${('percent' in v) ? (toNum(v.percent).toFixed(2) + '%') : (toNum(v.payment||0)&&toNum(credit||0) ? ((toNum(v.payment)/toNum(credit))*100).toFixed(2)+'%' : '')}</td><td>${v.date || (v.ts ? formatYMDWeek(new Date(v.ts)) : '')}</td><td>${(v.notes||'')}</td>`;
      searchPaymentsTableBody.appendChild(tr);
      sum.add += +(v.additional||0);
      sum.pay += +(v.payment||0);
      sum.misc += +(v.misc||0);
    });
    searchPaymentsTotals.innerHTML = `<td>Σ</td><td>–</td><td>${money(sum.add)}</td><td>${money(sum.pay)}</td><td>${money(sum.misc)}</td><td>–</td><td></td>`;
  }

  function renderAccResults(list){
    accSearchResults.innerHTML = '';
    if(!list.length){
      accSearchResults.innerHTML = '<div class="row"><div>No accounts found.</div></div>';
      return;
    }
    list.forEach(({key,a})=>{
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<div><div><strong>${(a && (a.name||key))}</strong></div><div class="meta">${key}</div></div>`;
      row.addEventListener('click', ()=>{
        if(!auth.currentUser){ openModal(modalAdmin); modalAdmin.dataset.nextPage='page-search-accounts'; return; }
        sAccId.value = key;
        sAccName.value = (a && (a.name||key)) || key;
        refs.accounts.child(key).child('entries').once('value').then(s=> renderSearchPaymentsTable(s.val()||{}));
      });
      accSearchResults.appendChild(row);
    });
  }

  function loadAccountsOnce(){
    return refs.accounts.once('value').then(s=> s.val()||{});
  }

  const doAccSearch = debounce(()=>{
    const q = (accSearchInput && accSearchInput.value||'').trim().toLowerCase();
    if(!q){ if(accSearchResults) accSearchResults.innerHTML=''; return; }
    loadAccountsOnce().then(accs=>{
      const arr = Object.entries(accs).map(([key,a])=>({key,a}));
      const filt = arr.filter(({key,a})=>{
        const name = (a && (a.name||'')) || '';
        const hay = (key + ' ' + name).toLowerCase();
        return hay.includes(q);
      }).slice(0,50);
      renderAccResults(filt);
    });
  }, 200);

  accSearchInput && accSearchInput.addEventListener('input', doAccSearch);
  btnClearAccSearch && btnClearAccSearch.addEventListener('click', ()=>{
    if(accSearchInput) accSearchInput.value='';
    if(accSearchResults) accSearchResults.innerHTML='';
    if(searchPaymentsTableBody) searchPaymentsTableBody.innerHTML='';
    if(searchPaymentsTotals) searchPaymentsTotals.innerHTML='<td>Σ</td><td>–</td><td>0.00</td><td>0.00</td><td>0.00</td><td>–</td><td>–</td><td></td><td></td>';
  });

})();
  function ensureDefaultDate(){ if (peDate && !String(peDate.value||'').trim()) { peDate.value = formatYMDWeek(new Date()); } }

try{
  const vv = window.visualViewport;
  const kbThreshold = 140;
  if(vv){
    let base = vv.height;
    vv.addEventListener('resize', ()=>{
      const open = (base - vv.height) > kbThreshold;
      document.body.classList.toggle('keyboard-open', open);
    });
  }
}catch(e){}
