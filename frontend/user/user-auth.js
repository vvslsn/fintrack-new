"use strict";
async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function getAccounts() { return readJSON(USER_KEYS.accounts, []); }
function findMemberByAccount(account) {
  return getMemberForUser(account);
}

// Member logins are created and linked by the Admin from the Members page.
// Do not create or auto-link a generic account here: doing so can expose
// another member's financial records.
function ensureDefaultUserAccount() {
  const accounts = getAccounts();
  const normalized = accounts.map(account => ({
    ...account,
    role: String(account.role || (account.memberId != null ? "user" : "admin")).toLowerCase()
  }));
  writeJSON(USER_KEYS.accounts, normalized);
  return normalized;
}

document.addEventListener("DOMContentLoaded", () => {
  ensureDefaultUserAccount();
  if (currentUser()) { location.replace("user-dashboard.html"); return; }
  const form = document.getElementById("userLoginForm");
  const msg = document.getElementById("loginMessage");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const account = getAccounts().find(a => String(a.username||"").toLowerCase() === username.toLowerCase());
    if (!account) { msg.textContent="User account not found. Please contact the admin."; msg.className="message error"; return; }
    if (String(account.role||"user").toLowerCase() === "admin") { msg.textContent="Admin accounts must use the Admin Login."; msg.className="message error"; return; }
    const valid = account.passwordHash ? (await hashPassword(password) === account.passwordHash) : password === account.password;
    if (!valid) { msg.textContent="Invalid username or password."; msg.className="message error"; return; }
    const member = findMemberByAccount(account);
    if (!member || account.memberId == null || String(member.id) !== String(account.memberId)) {
      msg.textContent="This login is not linked to an active member record. Please contact the admin.";
      msg.className="message error";
      return;
    }
    const updated = {
      ...account,
      role:"user",
      memberId: member.id,
      fullName: member.name || account.fullName || "Member",
      email: member.email || account.email || "",
      phone: member.phone || account.phone || "",
      profilePhoto: member.profilePhoto || account.profilePhoto || "",
      lastLogin:new Date().toISOString()
    };
    const accounts = getAccounts().map(a => String(a.username||"").toLowerCase()===username.toLowerCase()?updated:a);
    writeJSON(USER_KEYS.accounts, accounts);
    writeJSON(USER_KEYS.current, updated);
    sessionStorage.setItem("loggedIn","true");
    sessionStorage.setItem("currentUser", JSON.stringify(updated));
    sessionStorage.setItem("fintrackActivePortal", "member");
    msg.textContent="Login successful. Opening your dashboard…"; msg.className="message success";
    setTimeout(()=>location.href="user-dashboard.html", 450);
  });
  document.getElementById("togglePassword")?.addEventListener("click", function(){
    const input=document.getElementById("password"); input.type=input.type==="password"?"text":"password"; this.textContent=input.type==="password"?"👁":"🙈";
  });
});
