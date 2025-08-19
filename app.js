// v3.9 - Light theme, single top-left hamburger, overlay sidebar, auto-hide after selection.
(function(){
  const cfg = window.__FIREBASE_CONFIG__;
  const app = firebase.initializeApp(cfg);
  const db = firebase.database();
  const auth = firebase.auth();
  const statusDot = document.getElementById('statusDot');

  // Connectivity
  db.ref('.info/connected').on('value', snap => { statusDot.classList.toggle('ok', !!snap.val()); });

  // Sidebar toggles
  const sidebar = document.getElementById('sidebar');
  const btnHamburgerTop = document.getElementById('btnHamburgerTop');
  function toggleSidebar(){ sidebar.classList.toggle('collapsed'); }
  function hideSidebar(){ sidebar.classList.add('collapsed'); }
  function showSidebar(){ sidebar.classList.remove('collapsed'); }
  btnHamburgerTop.addEventListener('click', toggleSidebar);

  // Navigation
  const pages = document.querySelectorAll('.page');
  const menuButtons = document.querySelectorAll('.menu .menu-item[data-target]');
  function setActivePage(id){
    pages.forEach(p=>p.classList.remove('visible'));
    document.getElementById(id).classList.add('visible');
    menuButtons.forEach(b=> b.classList.toggle('active', b.dataset.target===id));
  }
  setActivePage('page-settings');

  // Elements common
  const adminAuthState = document.getElementById('adminAuthState');
  const accountAuthState = document.getElementById('accountAuthState');
  const btnAdminLogout = document.getElementById('btnAdminLogout');
  const btnAccountLogout = document.getElementById('btnAccountLogout');
  const menuMyAccount = document.getElementById('menuMyAccount');

  // My Account view bits
  const myAccountId = document.getElementById('myAccountId');
  const myAccountName = document.getElementById('myAccountName');
  const myAccountEmail = document.getElementById('myAccountEmail');
  const myAccountWelcome = document.getElementById('myAccountWelcome');
  const myEntriesTable = document.getElementById('myEntriesTable');
  const myEntriesTableBody = myEntriesTable.querySelector('tbody');
  const myEntriesTotals = document.getElementById('myEntriesTotals');
  const mStatAdd = document.getElementById('mStatAdd');
  const mStatPay = document.getElementById('mStatPay');
  const mStatBal = document.getElementById('mStatBal');
  const btnRefreshMyEntries = document.getElementById('btnRefreshMyEntries');

  // Admin page bits
  const accId = document.getElementById('accId');
  const accName = document.getElementById('accName');
  const btnClearSelection = document.getElementById('btnClearSelection');
  const peCredit = document.getElementById('peCredit');
  const peAdditional = document.getElementById('peAdditional');
  const pePayment = document.getElementById('pePayment');
  const peMisc = document.getElementById('peMisc');
  const peBalance = document.getElementById('peBalance');
  const peNotes = document.getElementById('peNotes');
  const btnAddEntry = document.getElementById('btnAddEntry');
  const btnUpdateEntry = document.getElementById('btnUpdateEntry');
  const btnClearEntry = document.getElementById('btnClearEntry');
  const paymentsTable = document.getElementById('paymentsTable');
  const paymentsTableBody = paymentsTable.querySelector('tbody');
  const paymentsTotals = document.getElementById('paymentsTotals');
  const statTotalAdd = document.getElementById('statTotalAdd');
  const statTotalPay = document.getElementById('statTotalPay');
  const statCurrentBal = document.getElementById('statCurrentBal');

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
  let myAccountSession = null;
  let selectedPaymentKey = null;
  let usersCache = null;

  // Utils
  const CURRENCY = 'QAR';
  const fmt = new Intl.NumberFormat(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
  const fmtQAR = new Intl.NumberFormat(undefined, {style:'currency', currency:CURRENCY, minimumFractionDigits:2});
  const money = (v)=> fmt.format(Number.isFinite(+v) ? (+v) : 0);
  const moneyQ = (v)=> fmtQAR.format(Number.isFinite(+v) ? (+v) : 0);
  const id = (len=20)=> Array.from(crypto.getRandomValues(new Uint8Array(len))).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,len);
  const debounce = (fn, ms=250)=>{ let t=null; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }; };

  /* ================= MODALS ================= */
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalMyAccount = document.getElementById('modalMyAccount');
  const modalAdmin = document.getElementById('modalAdmin');
  modalBackdrop.hidden = true; modalMyAccount.hidden = true; modalAdmin.hidden = true;
  function openModal(el){ modalBackdrop.hidden=false; el.hidden=false; hideSidebar(); }
  function closeModal(el){ el.hidden=true; if(modalMyAccount.hidden && modalAdmin.hidden){ modalBackdrop.hidden=true; } }
  document.querySelectorAll('.modal-close').forEach(btn=>{
    btn.addEventListener('click', (e)=>{ const id = e.currentTarget.getAttribute('data-close'); if(id) closeModal(document.getElementById(id)); });
  });
  modalBackdrop.addEventListener('click', ()=>{ [modalMyAccount, modalAdmin].forEach(m=> m.hidden=true); modalBackdrop.hidden=true; });

  /* ================= MY ACCOUNT ================= */
  const accLoginEmail = document.getElementById('accLoginEmail');
  const accLoginPassword = document.getElementById('accLoginPassword');
  const btnAccLogin = document.getElementById('btnAccLogin');
  const accLoginMsg = document.getElementById('accLoginMsg');

  function updateMyAccountUI(){
    const isIn = !!myAccountSession;
    accountAuthState.textContent = isIn ? 'Signed in' : 'Signed out';
    accountAuthState.classList.toggle('ok', isIn);
    accountAuthState.classList.toggle('danger', !isIn);
    menuMyAccount.textContent = isIn ? 'My Account' : 'Log in to My Account';
    myAccountWelcome.style.display = isIn ? 'inline-flex' : 'none';
    if(isIn){
      myAccountId.value = myAccountSession.accountId || '';
      myAccountName.value = myAccountSession.accountName || '';
      myAccountEmail.value = myAccountSession.email || '';
      myAccountWelcome.textContent = 'Welcome ' + (myAccountSession.accountName || myAccountSession.email || '');
      refreshMyEntries();
    }else{
      myEntriesTableBody.innerHTML = '<tr><td colspan="7">Please log in to see entries.</td></tr>';
      myEntriesTotals.innerHTML = '<td>Σ</td><td>–</td><td>0.00</td><td>0.00</td><td>0.00</td><td>–</td><td></td>';
      myAccountId.value = myAccountName.value = myAccountEmail.value = '';
    }
  }

  menuMyAccount.addEventListener('click', ()=>{
    if(!myAccountSession){ openModal(modalMyAccount); }
    else { setActivePage('page-myaccount'); }
    hideSidebar();
  });

  btnAccLogin.addEventListener('click', ()=>{
    const email = (accLoginEmail.value||'').trim().toLowerCase();
    const pass = (accLoginPassword.value||'').trim();
    if(!email || !pass){ accLoginMsg.textContent = 'Enter email & password'; return; }
    accLoginMsg.textContent = 'Checking...';
    refs.users.once('value').then(s=>{
      const users = s.val()||{};
      let foundKey = null, found = null;
      for(const [k,v] of Object.entries(users)){
        if((v.email||'').toLowerCase()===email && (v.password||'')===pass){ foundKey=k; found=v; break; }
      }
      if(!found){ accLoginMsg.textContent = 'Invalid email or password.'; return; }
      myAccountSession = { key: foundKey, accountId: found.accountId, accountName: found.accountName, email: found.email };
      accLoginMsg.textContent = 'Success!';
      closeModal(modalMyAccount);
      updateMyAccountUI();
      setActivePage('page-myaccount');
    }).catch(err=> accLoginMsg.textContent = 'Error: '+err.message);
  });
  btnAccountLogout.addEventListener('click', ()=>{ myAccountSession = null; updateMyAccountUI(); });

  function renderEntriesTable(targetTbody, totalsEl, entriesObj){
    targetTbody.innerHTML = '';
    const arr = Object.entries(entriesObj || {}).map(([k,v])=> ({k, ...v}));
    arr.sort((a,b)=> (a.ts||0) - (b.ts||0)); // oldest first
    if(arr.length===0){
      targetTbody.innerHTML = '<tr><td colspan="7">No entries yet.</td></tr>';
      totalsEl.innerHTML = '<td>Σ</td><td>–</td><td>0.00</td><td>0.00</td><td>0.00</td><td>–</td><td></td>';
      return;
    }
    let idx = 1;
    let sum = { add:0, pay:0, misc:0 };
    arr.forEach(v=>{
      const credit = ('credit' in v) ? v.credit : (v.initial || 0);
      const tr = document.createElement('tr');
      tr.dataset.key = v.k;
      tr.innerHTML = `
        <td>${idx++}</td>
        <td>${money(credit||0)}</td>
        <td>${money(v.additional||0)}</td>
        <td>${money(v.payment||0)}</td>
        <td>${money(v.misc||0)}</td>
        <td>${money(v.balance||0)}</td>
        <td>${(v.notes||'')}</td>`;
      sum.add += +(v.additional||0);
      sum.pay += +(v.payment||0);
      sum.misc += +(v.misc||0);
      targetTbody.appendChild(tr);
    });
    totalsEl.innerHTML = `<td>Σ</td><td>–</td><td>${money(sum.add)}</td><td>${money(sum.pay)}</td><td>${money(sum.misc)}</td><td>–</td><td></td>`;
    // Update stat cards for My Account
    try {
      if (mStatAdd && mStatPay && mStatBal) {
        const lastBal = (arr.length ? (arr[arr.length-1].balance || 0) : 0);
        mStatAdd.textContent = moneyQ(sum.add || 0);
        mStatPay.textContent = moneyQ(sum.pay || 0);
        mStatBal.textContent = moneyQ(lastBal || 0);
      }
    } catch(e) {}

  }

  function refreshMyEntries(){
    if(!myAccountSession || !myAccountSession.accountId){ myEntriesTableBody.innerHTML = '<tr><td colspan="7">Please log in.</td></tr>'; return; }
    refs.accounts.child(myAccountSession.accountId).child('entries').once('value').then(s=>{
      renderEntriesTable(myEntriesTableBody, myEntriesTotals, s.val());
    });
  }
  btnRefreshMyEntries.addEventListener('click', refreshMyEntries);

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
    if(requireAdminOrModal('page-admin-users'))         setActivePage('page-admin-users');
        hideSidebar();
        // Ensure the Add/Update User details panel is open and focused when editing
        const userDetails = document.querySelector('#page-admin-users details');
        if (userDetails) {
          userDetails.open = true;
          // Focus first input for quick editing
          const firstInput = userDetails.querySelector('input, select, textarea, button');
          if (firstInput && firstInput.focus) firstInput.focus();
        }
});
  document.getElementById('menuSettings').addEventListener('click', ()=>{ setActivePage('page-settings'); hideSidebar(); });

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
  btnAdminCreate.addEventListener('click', ()=>{
    adminLoginMsg.textContent = 'Creating...';
    auth.createUserWithEmailAndPassword(adminEmail.value.trim(), adminPassword.value.trim())
      .then(()=> adminLoginMsg.textContent = 'Admin created. Now signed in.')
      .catch(err=> adminLoginMsg.textContent = 'Error: '+err.message);
  });
  btnAdminForgot.addEventListener('click', ()=>{
    const email = adminEmail.value.trim();
    if(!email) return adminLoginMsg.textContent='Enter email first.';
    auth.sendPasswordResetEmail(email)
      .then(()=> adminLoginMsg.textContent='Password reset email sent.')
      .catch(err=> adminLoginMsg.textContent='Error: '+err.message);
  });
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
      return;
    }
    let idx=1;
    let sum = { add:0, pay:0, misc:0 };
    arr.forEach(v=>{
      const credit = ('credit' in v) ? v.credit : (v.initial || 0);
      const tr = document.createElement('tr');
      tr.dataset.key = v.k;
      tr.innerHTML = `
        <td>${idx++}</td>
        <td>${money(credit||0)}</td>
        <td>${money(v.additional||0)}</td>
        <td>${money(v.payment||0)}</td>
        <td>${money(v.misc||0)}</td>
        <td>${money(v.balance||0)}</td>
        <td>${(v.notes||'')}</td>
        <td><button class="danger btnDelete">Delete</button></td>`;
      paymentsTableBody.appendChild(tr);
      sum.add += +(v.additional||0);
      sum.pay += +(v.payment||0);
      sum.misc += +(v.misc||0);
    });
    paymentsTotals.innerHTML = `<td>Σ</td><td>–</td><td>${money(sum.add)}</td><td>${money(sum.pay)}</td><td>${money(sum.misc)}</td><td>–</td><td></td><td></td>`;
    // Update stat cards for Admin
    try {
      if (statTotalAdd && statTotalPay && statCurrentBal) {
        const lastBal = (arr.length ? (arr[arr.length-1].balance || 0) : 0);
        statTotalAdd.textContent = moneyQ(sum.add || 0);
        statTotalPay.textContent = moneyQ(sum.pay || 0);
        statCurrentBal.textContent = moneyQ(lastBal || 0);
      }
    } catch(e) {}

    // after render, set default credit
    setCreditDefaultForAdd(arr);
  }

  function refreshPaymentsTable(){
    const key = accId.value.trim();
    if(!key){ paymentsTableBody.innerHTML='<tr><td colspan="8">Select an account via User Search.</td></tr>'; paymentsTotals.innerHTML='<td>Σ</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td></td><td></td>'; return; }
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

  function recalcBalance(){
    const credit = parseFloat(peCredit.value||'0')||0;
    const add = parseFloat(peAdditional.value||'0')||0;
    const pay = parseFloat(pePayment.value||'0')||0;
    const bal = credit + add - pay;
    peBalance.value = money(bal);
  }

  ['input','change'].forEach(evt => {
    [peCredit, peAdditional, pePayment].forEach(el => el.addEventListener(evt, recalcBalance));
  });

  btnClearSelection.addEventListener('click', ()=>{
    accId.value='';
    accName.value='';
    paymentsTableBody.innerHTML='<tr><td colspan="8">Select an account via User Search.</td></tr>';
    paymentsTotals.innerHTML='<td>Σ</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td></td><td></td>';
    peCredit.value=''; peCredit.readOnly=false; peCredit.placeholder='first entry only';
    [peAdditional, pePayment, peMisc, peBalance, peNotes].forEach(i=> i.value='');
    selectedPaymentKey=null; btnUpdateEntry.disabled=true;
  });

  function clearPaymentForm(){
    [peAdditional, pePayment, peMisc, peBalance, peNotes].forEach(i=> i.value='');
    selectedPaymentKey = null;
    btnUpdateEntry.disabled = true;
    Array.from(paymentsTableBody.querySelectorAll('tr')).forEach(tr=>tr.classList.remove('active'));
    refreshPaymentsTable(); // will reset credit default
  }
  btnClearEntry.addEventListener('click', clearPaymentForm);

  btnAddEntry.addEventListener('click', ()=>{
    if(!auth.currentUser){ openModal(modalAdmin); modalAdmin.dataset.nextPage='page-admin-payments'; return; }
    const key = accId.value.trim();
    if(!key) return alert('Pick an account via User Search first');
    if(!peBalance.value) recalcBalance();
    const payload = {
      credit: +(peCredit.value||0),
      additional: +(peAdditional.value||0),
      payment: +(pePayment.value||0),
      misc: +(peMisc.value||0),
      balance: +(peBalance.value||0),
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
    const payload = {
      credit: +(peCredit.value||0),
      additional: +(peAdditional.value||0),
      payment: +(pePayment.value||0),
      misc: +(peMisc.value||0),
      balance: +(peBalance.value||0),
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
      peCredit.value = money(credit||0);
      peCredit.readOnly = true; // keep credit locked to maintain history logic
      peCredit.placeholder = 'credit locked (from history)';
      peAdditional.value = v.additional || '';
      pePayment.value = v.payment || '';
      peMisc.value = v.misc || '';
      peBalance.value = money(v.balance||0);
      peNotes.value = v.notes || '';
      selectedPaymentKey = rowKey;
      btnUpdateEntry.disabled = false;
      Array.from(paymentsTableBody.querySelectorAll('tr')).forEach(x=>x.classList.remove('active'));
      tr.classList.add('active');
      setActivePage('page-admin-payments');
    });
  });

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
})();