"use strict";

const USER_KEYS = {
  accounts: "fintrackAccounts",
  current: "fintrackUser",
  members: "chitfund_members",
  schemes: "chitfund_schemes",
  payments: "chitfund_payments",
  winners: "chitfund_winners",
  notifications: "chitfund_notifications"
};

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch (e) { return fallback; }
}
function writeJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}
function money(value) { return new Intl.NumberFormat("en-IN", {style:"currency", currency:"INR", maximumFractionDigits:2}).format(Number(value)||0); }
function dateText(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return d.toLocaleDateString("en-IN", {day:"2-digit", month:"short", year:"numeric"});
}
function todayISO() { return new Date().toISOString().slice(0,10); }
function currentUser() {
  // Member portal must never treat an administrator account as a member.
  // The old shared fintrackUser key could contain the last admin account,
  // which caused the member portal to open automatically.
  const candidates = [
    readJSON("currentUser", null),
    readJSON(USER_KEYS.current, null)
  ];
  return candidates.find(user =>
    user && String(user.role || "").trim().toLowerCase() === "user"
  ) || null;
}
function members() { return readJSON(USER_KEYS.members, []); }
function schemes() { return readJSON(USER_KEYS.schemes, []); }
function payments() { return readJSON(USER_KEYS.payments, []); }
function winners() { return readJSON(USER_KEYS.winners, []); }
function getMemberForUser(user) {
  if (!user || user.memberId == null) return null;
  return members().find(m => String(m.id) === String(user.memberId)) || null;
}

// Protect member-only pages from being opened with an admin session.
document.addEventListener("DOMContentLoaded", () => {
  const page = String(location.pathname || "").split("/").pop().toLowerCase();
  const isLoginPage = page === "user-login.html" || page === "index.html";
  if (!isLoginPage && !currentUser()) {
    location.replace("user-login.html");
  }
});

function userSchemeEntries(member) { return Array.isArray(member?.schemes) ? member.schemes : []; }
function userSchemes(member) {
  const all = schemes();
  return userSchemeEntries(member).map(entry => all.find(s => String(s.id)===String(entry.id) || String(s.name||"").toLowerCase()===String(entry.name||"").toLowerCase()) || entry);
}
function ticketEntries(member) {
  return userSchemeEntries(member).map(entry => {
    const scheme = schemes().find(s => String(s.id)===String(entry.id) || String(s.name||"").toLowerCase()===String(entry.name||"").toLowerCase()) || {};
    return {...entry, scheme};
  });
}
function sameText(a, b) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}
function sameTicket(a, b) {
  const left = String(a ?? "").trim();
  const right = String(b ?? "").trim();
  return !!left && !!right && left === right;
}
function getWinnerForUserTicket(scheme, ticket, member) {
  if (!scheme || ticket == null || !member) return null;
  const ws = winners();
  const memberId = member.id != null ? String(member.id) : "";
  const schemeId = scheme.id != null ? String(scheme.id) : "";
  const ticketText = String(ticket).trim();
  return ws.find(w =>
    w.memberId != null && memberId && String(w.memberId) === memberId &&
    w.schemeId != null && schemeId && String(w.schemeId) === schemeId &&
    sameTicket(w.ticket ?? w.ticketNumber, ticketText) &&
    String(w.status || "winner").toLowerCase() === "winner"
  ) || null;
}
function paymentAmountForMonth(scheme, entry, month, member) {
  if (typeof window.fintrackPaymentAmount === "function") return window.fintrackPaymentAmount(scheme, month, member, entry?.ticket ?? entry?.ticketNumber ?? entry?.ticketNo);
  if (!scheme) return 0;
  const m = Number(month || 0);
  if (!Number.isInteger(m) || m < 1) return 0;

  if (isGold(scheme)) {
    const monthly = scheme.goldMonthlyInstallments || {};
    const configured = monthly[String(m)] ?? monthly[m];
    return Number(configured ?? entry?.normalPayment ?? scheme.baseAmount ?? 0) || 0;
  }

  const total = Number(scheme.totalAmount || entry?.chitAmount || 0);
  if (total <= 0) return Number(entry?.normalPayment || scheme.baseAmount || 0);

  const normal = Math.round(total * 0.05);
  const winnerAmount = Math.round(total * 0.06);
  const winner = getWinnerForUserTicket(
    scheme,
    entry?.ticket ?? entry?.ticketNumber ?? entry?.ticketNo,
    member
  );
  const winningMonth = Number(winner?.month || entry?.winningMonth || 0);
  return winningMonth > 0 && m >= winningMonth ? winnerAmount : normal;
}

function chitDateForScheme(scheme) {
  if (!scheme?.startDate) return null;
  const parts=String(scheme.startDate).split("-").map(Number);
  if(parts.length!==3||parts.some(Number.isNaN)) return null;
  return {year:parts[0], month:parts[1]-1, day:parts[2]};
}
function userDueDateForMonth(scheme, month) {
  if (typeof window.getFintrackDueDate === "function") return window.getFintrackDueDate(scheme, month);
  return "";
}
function userTodayDateOnly() { const n=new Date(); return new Date(n.getFullYear(),n.getMonth(),n.getDate()); }
function userDueDateIsReached(value) {
  if (typeof window.fintrackDateReached === "function") return window.fintrackDateReached(value);
  return false;
}
function userCurrentDueMonth(scheme) {
  if (typeof window.getFintrackCurrentDueMonth === "function") return window.getFintrackCurrentDueMonth(scheme);
  return 0;
}

function userVisiblePayments(member) {
  const all=userPayments(member);
  return all.filter(p=>{
    if(String(p.status||"").toLowerCase()==="paid") return true;
    const scheme=schemes().find(s=>
      (p.schemeId!=null&&s.id!=null&&String(s.id)===String(p.schemeId)) ||
      String(s.name||"").trim().toLowerCase()===String(p.scheme||"").trim().toLowerCase()
    );
    const due=scheme ? userDueDateForMonth(scheme,p.month) : p.dueDate;
    return userDueDateIsReached(due);
  });
}
function userRecentPaidPayments(member) {
  return userPayments(member).filter(p=>String(p.status||"").toLowerCase()==="paid");
}

function userPayments(member) {
  if (!member) return [];
  const all = payments();
  return all.filter(p => p.memberId != null && String(p.memberId) === String(member.id)).map(p => {
    // Never change a completed payment receipt. For pending/unpaid records,
    // calculate the payable amount from the member's winning month so the
    // User Portal immediately reflects the increased installment.
    if (String(p.status || "").toLowerCase() === "paid") return p;
    const scheme = schemes().find(s =>
      (p.schemeId != null && s.id != null && String(s.id) === String(p.schemeId)) ||
      String(s.name || "").trim().toLowerCase() === String(p.scheme || "").trim().toLowerCase()
    );
    if (!scheme) return p;
    const entry = userSchemeEntries(member).find(e =>
      String(e.ticket ?? e.ticketNumber ?? e.ticketNo ?? "").trim() === String(p.ticket ?? "").trim() &&
      ((e.id != null && scheme.id != null && String(e.id) === String(scheme.id)) ||
       String(e.name || "").trim().toLowerCase() === String(scheme.name || "").trim().toLowerCase())
    ) || {};
    const calculated = paymentAmountForMonth(scheme, entry, p.month, member);
    return calculated > 0 ? {...p, amount: calculated} : p;
  });
}
function userWinners(member) {
  if (!member) return [];
  const entries = userSchemeEntries(member);
  return winners().filter(w => entries.some(entry => {
    const scheme = schemes().find(s =>
      (entry.id != null && s.id != null && String(s.id) === String(entry.id)) ||
      sameText(s.name, entry.name)
    );
    if (!scheme) return false;
    const ticket = entry.ticket ?? entry.ticketNumber ?? entry.ticketNo;
    const winnerTicket = w.ticket ?? w.ticketNumber ?? w.ticketNo;
    if (!sameTicket(winnerTicket, ticket)) return false;

    const memberMatch =
      (w.memberId != null && member.id != null && String(w.memberId) === String(member.id)) ||
      (w.memberName != null && sameText(w.memberName, member.name)) ||
      (w.member != null && sameText(w.member, member.name));
    if (!memberMatch) return false;

    return (
      (w.schemeId != null && scheme.id != null && String(w.schemeId) === String(scheme.id)) ||
      (w.scheme != null && sameText(w.scheme, scheme.name)) ||
      (w.schemeName != null && sameText(w.schemeName, scheme.name))
    );
  }));
}

function getInitials(name) { return String(name||"U").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "U"; }
function statusBadge(status) {
  const s = String(status||"").toLowerCase();
  const cls = s === "paid" || s === "settled" || s === "active" || s === "yes" ? "success" : s === "pending" ? "warning" : s === "won" ? "purple" : "neutral";
  return `<span class="badge ${cls}">${esc(status || "—")}</span>`;
}
function logout() {
  sessionStorage.removeItem("loggedIn");
  sessionStorage.removeItem("currentUser");
  localStorage.removeItem(USER_KEYS.current);
  location.href = "user-login.html";
}
function requireUser() {
  const user = currentUser();
  if (!user) { location.replace("user-login.html"); return null; }

  // Always resolve the account against its linked member. This keeps the
  // member portal dynamic: if Admin Sai creates Kishore and gives Kishore
  // his own login, Kishore sees Kishore's details; existing accounts never
  // switch to a newly created member.
  const member = getMemberForUser(user);
  if (member) {
    const synced = {
      ...user,
      fullName: member.name || user.fullName || user.username || "Member",
      email: member.email || user.email || "",
      phone: member.phone || user.phone || "",
      memberId: member.id,
      profilePhoto: member.profilePhoto || user.profilePhoto || "",
      role: "user"
    };
    writeJSON(USER_KEYS.current, synced);
    sessionStorage.setItem("currentUser", JSON.stringify(synced));
    return synced;
  }
  return user;
}
function isGold(scheme) { return String(scheme?.type||scheme?.chitType||"").toLowerCase().includes("gold") || String(scheme?.name||"").toLowerCase().includes("gold"); }
function paymentAmountForScheme(scheme, entry, member, month) {
  const requestedMonth = Number(month || userCurrentDueMonth(scheme) || 1);
  return paymentAmountForMonth(scheme, entry, requestedMonth, member);
}

function renderShell(active, title) {
  const user = currentUser();
  const name = user?.fullName || user?.name || user?.username || "Member";
  const initials = getInitials(name);
  document.body.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="logo">
          <span class="logo-icon">₹</span>
          <span class="logo-text">FinTrack</span>
        </div>
        <nav class="sidebar-nav">
          <a class="nav-item ${active==='dashboard'?'active':''}" href="user-dashboard.html"><span class="nav-icon">🏠</span><span>Dashboard</span></a>
          <a class="nav-item ${active==='schemes'?'active':''}" href="user-schemes.html"><span class="nav-icon">📋</span><span>My Schemes</span></a>
          <a class="nav-item ${active==='payments'?'active':''}" href="user-payments.html"><span class="nav-icon">💳</span><span>My Payments</span></a>
          <a class="nav-item ${active==='notifications'?'active':''}" href="user-notifications.html"><span class="nav-icon">🔔</span><span>Notifications</span></a>
        </nav>
      </aside>
      <main class="main-content">
        <header class="top-header">
          <div class="header-left">
            <div>
              <h1>${esc(title)}</h1>
              <p>${active==='dashboard' ? 'Welcome back to FinTrack' : 'FinTrack Member Portal'}</p>
            </div>
          </div>
          <div class="header-right">
            <div class="profile-host">
              <button type="button" class="user-header profile-trigger" id="profileTrigger" aria-label="Open profile menu" aria-haspopup="true" aria-expanded="false">
                <span class="user-avatar${user?.profilePhoto ? " has-photo" : ""}" id="headerAvatar">${user?.profilePhoto ? `<img src="${esc(user.profilePhoto)}" alt="Profile photo">` : esc(initials)}</span>
                <span class="header-user-info"><strong id="headerUserName">${esc(name)}</strong><span>MEMBER</span></span>
              </button>
              <button type="button" class="profile-menu-button" id="profileMenuButton" aria-label="Profile menu" aria-haspopup="true" aria-expanded="false"><span aria-hidden="true">⋮</span></button>
              <div class="profile-menu" id="profileMenu" role="menu">
                <button type="button" class="profile-menu-item" data-action="edit"><span class="profile-menu-icon">✎</span><span>Edit Profile</span></button>
                <button type="button" class="profile-menu-item" data-action="password"><span class="profile-menu-icon">🔒</span><span>Change Password</span></button>
                <button type="button" class="profile-menu-item" data-action="payout"><span class="profile-menu-icon">🏦</span><span>Payout Details</span></button>
                <div class="profile-menu-divider"></div>
                <button type="button" class="profile-menu-item danger" data-action="logout"><span class="profile-menu-icon">↪</span><span>Logout</span></button>
              </div>
            </div>
          </div>
        </header>
        <div id="pageContent" class="page-content"></div>
      </main>
    </div>`;
  setupUserProfileMenu();
}

function setupUserProfileMenu(){
  const btn=document.getElementById('profileMenuButton');
  const menu=document.getElementById('profileMenu');
  if(!btn||!menu) return;
  const close=()=>{menu.classList.remove('show');btn.setAttribute('aria-expanded','false');};
  btn.addEventListener('click',e=>{e.stopPropagation(); const open=menu.classList.toggle('show');btn.setAttribute('aria-expanded',String(open));});
  menu.addEventListener('click',e=>{const item=e.target.closest('[data-action]');if(!item)return;close();const a=item.dataset.action;if(a==='edit')openUserEditProfile();if(a==='password')openUserChangePassword();if(a==='payout')openUserPayoutDetails();if(a==='logout')logout();});
  document.addEventListener('click',e=>{if(!menu.contains(e.target)&&e.target!==btn)close();},{once:false});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();closeUserModal('userEditProfileModal');closeUserModal('userPasswordModal');closeUserModal('userPayoutModal');}});
}

function closeUserModal(id){document.getElementById(id)?.classList.remove('show');}
function showUserModal(id){document.getElementById(id)?.classList.add('show');}
function createUserModal(id,html){if(document.getElementById(id))return;const el=document.createElement('div');el.id=id;el.className='user-modal-overlay';el.innerHTML=html;document.body.appendChild(el);el.addEventListener('click',e=>{if(e.target===el||e.target.closest('[data-close]'))closeUserModal(id);});}
function openUserEditProfile(){
  const user=currentUser(); if(!user)return;
  createUserModal('userEditProfileModal',`<div class="user-modal profile-editor-modal">
    <div class="user-modal-header"><h2>Edit Profile</h2><button class="user-modal-close" data-close>×</button></div>
    <div class="profile-photo-editor">
      <div class="profile-photo-preview" id="editProfilePhotoPreview">${user.profilePhoto?`<img src="${esc(user.profilePhoto)}" alt="Profile photo">`:`<span>${esc(getInitials(user.fullName||user.name||user.username||'Member'))}</span>`}</div>
      <div class="profile-photo-actions">
        <label class="photo-upload-btn" for="editUserPhoto">Upload Profile Photo</label>
        <input id="editUserPhoto" type="file" accept="image/*" hidden>
        <button type="button" class="photo-remove-btn" id="removeUserPhoto" ${user.profilePhoto?'':'disabled'}>Remove Photo</button>
        <small>JPG, PNG or WEBP. Maximum 2 MB.</small>
      </div>
    </div>
    <div class="user-modal-form"><label>Full Name</label><input id="editUserName" type="text">
      <label>Email</label><input id="editUserEmail" type="email">
      <label>Phone</label><input id="editUserPhone" type="tel">
      <label>Username</label><input id="editUserUsername" type="text" readonly>
    </div>
    <div class="user-modal-footer"><button class="modal-cancel" data-close>Cancel</button><button class="modal-save" id="saveUserProfile">Save Profile</button></div>
  </div>`);
  const nameInput=document.getElementById('editUserName');
  const emailInput=document.getElementById('editUserEmail');
  const phoneInput=document.getElementById('editUserPhone');
  const usernameInput=document.getElementById('editUserUsername');
  nameInput.value=user.fullName||user.name||''; emailInput.value=user.email||''; phoneInput.value=user.phone||''; usernameInput.value=user.username||'';
  let profilePhoto=user.profilePhoto||'';
  const preview=document.getElementById('editProfilePhotoPreview');
  const removeBtn=document.getElementById('removeUserPhoto');
  const renderPreview=()=>{ preview.innerHTML=profilePhoto?`<img src="${esc(profilePhoto)}" alt="Profile photo">`:`<span>${esc(getInitials(nameInput.value||user.username||'Member'))}</span>`; removeBtn.disabled=!profilePhoto; };
  document.getElementById('editUserPhoto').addEventListener('change',e=>{
    const file=e.target.files?.[0]; if(!file)return;
    if(file.size>2*1024*1024){alert('Profile photo must be 2 MB or smaller.');e.target.value='';return;}
    if(!file.type.startsWith('image/')){alert('Please select an image file.');e.target.value='';return;}
    const reader=new FileReader(); reader.onload=()=>{profilePhoto=String(reader.result||'');renderPreview();}; reader.readAsDataURL(file);
  });
  removeBtn.addEventListener('click',()=>{profilePhoto='';document.getElementById('editUserPhoto').value='';renderPreview();});
  nameInput.addEventListener('input',()=>{if(!profilePhoto)renderPreview();});
  document.getElementById('saveUserProfile').onclick=()=>{
    const name=nameInput.value.trim(),email=emailInput.value.trim(),phone=phoneInput.value.trim();
    if(!name)return alert('Please enter your name.');
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return alert('Please enter a valid email address.');
    const existing=currentUser();
    const linked=existing?.memberId != null ? members().find(m=>String(m.id)===String(existing.memberId)) : null;
    if(!linked) return alert('Your account is not linked to a member record. Please contact the admin.');
    const updatedMember={...linked,name,email,phone,profilePhoto};
    writeJSON(USER_KEYS.members,members().map(m=>String(m.id)===String(linked.id)?updatedMember:m));
    const updated={...existing,fullName:name,email,phone,profilePhoto,memberId:linked.id,role:'user'};
    writeJSON(USER_KEYS.current,updated); sessionStorage.setItem('currentUser',JSON.stringify(updated));
    const accounts=readJSON(USER_KEYS.accounts,[]).map(a=>String(a.memberId)===String(linked.id)?{...a,fullName:name,email,phone,profilePhoto,memberId:linked.id,role:'user'}:a);
    writeJSON(USER_KEYS.accounts,accounts);
    closeUserModal('userEditProfileModal'); updateUserHeader(updated); alert('Profile updated successfully.');
  };
  showUserModal('userEditProfileModal');
}
function openUserPayoutDetails(){
  const user=currentUser(); if(!user)return;
  const linked=user.memberId!=null?members().find(m=>String(m.id)===String(user.memberId)):null;
  if(!linked)return alert('Your account is not linked to a member record. Please contact the admin.');
  const d=linked.payoutDetails||{};
  createUserModal('userPayoutModal',`<div class="user-modal payout-modal">
    <div class="user-modal-header"><h2>My Payout Details</h2><button class="user-modal-close" data-close>×</button></div>
    <p class="muted" style="font-size:12px;margin:-8px 0 18px">Add your bank or UPI details so the admin can send your cash chit winning amount.</p>
    <div class="user-modal-form">
      <label>Account Holder Name</label><input id="payoutHolder" type="text" autocomplete="name">
      <label>Bank Name</label><input id="payoutBank" type="text">
      <label>Account Number</label><input id="payoutAccount" type="text" inputmode="numeric" maxlength="20">
      <label>IFSC Code</label><input id="payoutIfsc" type="text" maxlength="11" style="text-transform:uppercase">
      <label>UPI ID</label><input id="payoutUpi" type="text" placeholder="example@upi">
      <label>PhonePe / UPI Mobile Number</label><input id="payoutPhone" type="tel" inputmode="numeric" maxlength="10">
      <label>UPI QR Code (optional)</label><input id="payoutQrFile" type="file" accept="image/png,image/jpeg,image/webp">
      <div id="payoutQrPreview" style="min-height:50px;color:#64748b;font-size:12px">${d.qrCode?`<img src="${esc(d.qrCode)}" alt="Your payout QR" style="max-width:150px;max-height:150px;border:1px solid #e5e7eb;border-radius:8px">`:'No QR code uploaded'}</div>
      <button type="button" class="modal-cancel" id="removePayoutQr" style="justify-self:start">Remove QR Code</button>
    </div>
    <div class="user-modal-footer"><button class="modal-cancel" data-close>Cancel</button><button class="modal-save" id="savePayoutDetails">Save Payout Details</button></div>
  </div>`);
  const ids={holder:'payoutHolder',bank:'payoutBank',account:'payoutAccount',ifsc:'payoutIfsc',upi:'payoutUpi',phone:'payoutPhone'};
  document.getElementById(ids.holder).value=d.holderName||'';document.getElementById(ids.bank).value=d.bankName||'';document.getElementById(ids.account).value=d.accountNumber||'';document.getElementById(ids.ifsc).value=d.ifsc||'';document.getElementById(ids.upi).value=d.upiId||'';document.getElementById(ids.phone).value=d.phonePeNumber||'';
  let qr=d.qrCode||'';
  const preview=document.getElementById('payoutQrPreview');
  const renderQr=()=>{preview.innerHTML=qr?`<img src="${esc(qr)}" alt="Your payout QR" style="max-width:150px;max-height:150px;border:1px solid #e5e7eb;border-radius:8px">`:'No QR code uploaded';};
  document.getElementById('payoutQrFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>2*1024*1024)return alert('QR image must be 2 MB or smaller.');if(!f.type.startsWith('image/'))return alert('Please select an image file.');const r=new FileReader();r.onload=()=>{qr=String(r.result||'');renderQr();};r.readAsDataURL(f);});
  document.getElementById('removePayoutQr').onclick=()=>{qr='';document.getElementById('payoutQrFile').value='';renderQr();};
  document.getElementById('savePayoutDetails').onclick=()=>{
    const holder=document.getElementById(ids.holder).value.trim(),bank=document.getElementById(ids.bank).value.trim(),account=document.getElementById(ids.account).value.trim(),ifsc=document.getElementById(ids.ifsc).value.trim().toUpperCase(),upi=document.getElementById(ids.upi).value.trim(),phone=document.getElementById(ids.phone).value.trim();
    if(!holder && !bank && !account && !ifsc && !upi && !phone && !qr)return alert('Add at least one bank, UPI, PhonePe, or QR detail.');
    if(account && !/^\d{8,20}$/.test(account))return alert('Account number must contain 8 to 20 digits.');
    if(ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc))return alert('Please enter a valid IFSC code.');
    if(phone && !/^\d{10}$/.test(phone))return alert('PhonePe number must contain 10 digits.');
    const updatedMember={...linked,payoutDetails:{holderName:holder,bankName:bank,accountNumber:account,ifsc,upiId:upi,phonePeNumber:phone,qrCode:qr,updatedAt:new Date().toISOString()}};
    writeJSON(USER_KEYS.members,members().map(m=>String(m.id)===String(linked.id)?updatedMember:m));
    closeUserModal('userPayoutModal');alert('Payout details saved successfully. The admin can use these details for your winning payout.');
  };
  showUserModal('userPayoutModal');
}
function getAccounts(){ return readJSON(USER_KEYS.accounts,[]); }
function printFintrackReceipt(payment){
  const p=payment||{}; if(String(p.status||"").toLowerCase()!=="paid"){alert("Receipt is available only for paid installments.");return;}
  const e=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const m=v=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v)||0);
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>FinTrack Payment Receipt</title><style>body{font-family:Arial;margin:0;padding:32px;background:#f4f6f8;color:#17202a}.receipt{max-width:720px;margin:auto;background:#fff;padding:36px;border:1px solid #dfe3e8;border-radius:12px}.brand{font-size:26px;font-weight:800}.sub{color:#667085}.title{text-align:center;margin:28px 0;font-size:22px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;border-block:1px solid #eee;padding:20px 0}.item span{display:block;color:#667085;font-size:12px;margin-bottom:5px}.amount{text-align:center;font-size:28px;font-weight:800;margin:24px 0}.footer{margin-top:28px;color:#667085;font-size:12px;text-align:center}@media print{body{background:#fff;padding:0}.receipt{border:0;max-width:none}}</style></head><body><div class="receipt"><div class="brand">FinTrack</div><div class="sub">Chit Fund Payment Receipt</div><div class="title">PAYMENT RECEIPT</div><div class="grid"><div class="item"><span>Member</span><b>${e(p.member||p.memberName||"Member")}</b></div><div class="item"><span>Ticket</span><b>#${e(p.ticket||"—")}</b></div><div class="item"><span>Scheme</span><b>${e(p.scheme||"—")}</b></div><div class="item"><span>Installment</span><b>Month ${e(p.month||"—")}</b></div><div class="item"><span>Payment Date</span><b>${e(p.paymentDate||"—")}</b></div><div class="item"><span>Transaction / UTR</span><b>${e(p.transactionId||"—")}</b></div></div><div class="amount">${m(p.amount)}</div><div style="text-align:center"><b>PAID</b></div><div class="footer">Computer-generated receipt from FinTrack.</div></div><script>window.onload=function(){window.print()}<\/script></body></html>`;
  const w=window.open("","_blank","width=820,height=900");if(!w){alert("Please allow pop-ups to print the receipt.");return;}w.document.write(html);w.document.close();
}

function openUserChangePassword(){
  const user=currentUser(); if(!user)return;
  createUserModal('userPasswordModal',`<div class="user-modal"><div class="user-modal-header"><h2>Change Password</h2><button class="user-modal-close" data-close>×</button></div><div class="user-modal-form"><label>Current Password</label><input id="userCurrentPassword" type="password" autocomplete="current-password"><label>New Password</label><input id="userNewPassword" type="password" autocomplete="new-password"><label>Confirm Password</label><input id="userConfirmPassword" type="password" autocomplete="new-password"></div><div class="user-modal-footer"><button class="modal-cancel" data-close>Cancel</button><button class="modal-save" id="saveUserPassword">Update Password</button></div></div>`);
  ['userCurrentPassword','userNewPassword','userConfirmPassword'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('saveUserPassword').onclick=async()=>{const cur=document.getElementById('userCurrentPassword').value,n=document.getElementById('userNewPassword').value,c=document.getElementById('userConfirmPassword').value;if(!cur)return alert('Please enter your current password.');const valid=user.passwordHash?(await hashUserPassword(cur)===user.passwordHash):cur===user.password;if(!valid)return alert('Current password is incorrect.');if(n.length<6)return alert('New password must contain at least 6 characters.');if(n!==c)return alert('Passwords do not match.');const updated={...user,passwordHash:await hashUserPassword(n)};delete updated.password;writeJSON(USER_KEYS.current,updated);sessionStorage.setItem('currentUser',JSON.stringify(updated));writeJSON(USER_KEYS.accounts,readJSON(USER_KEYS.accounts,[]).map(a=>String(a.username||'').toLowerCase()===String(updated.username||'').toLowerCase()?{...a,...updated}:a));closeUserModal('userPasswordModal');alert('Password changed successfully.');};
  showUserModal('userPasswordModal');
}
async function hashUserPassword(password){const data=new TextEncoder().encode(password);const digest=await crypto.subtle.digest('SHA-256',data);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');}
function updateUserHeader(user){const name=user?.fullName||user?.name||user?.username||'Member';const a=document.getElementById('headerAvatar'),n=document.getElementById('headerUserName');if(a){a.classList.toggle('has-photo',!!user?.profilePhoto);a.innerHTML=user?.profilePhoto?`<img src="${esc(user.profilePhoto)}" alt="Profile photo">`:esc(getInitials(name));}if(n)n.textContent=name;}
