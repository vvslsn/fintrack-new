(() => {
  "use strict";

  window.currentUser = () => {
    try { return JSON.parse(sessionStorage.getItem("currentUser") || "null"); }
    catch { return null; }
  };
  window.requireUser = () => {
    const user = currentUser();
    if (!user || user.role !== "user") {
      location.replace("user-login.html");
      return null;
    }
    if (user.mustChangePassword) {
      location.replace("user-change-password.html");
      return null;
    }
    return user;
  };

  window.esc = window.escHtml;
  window.userData = async () => {
    const user = requireUser();
    if (!user) return null;
    const [memberResponse, ticketResponse, paymentResponse, winnerResponse, notificationResponse] = await Promise.all([
      fintrackApi(`/members/${encodeURIComponent(user.memberId)}`),
      fintrackApi(`/members/${encodeURIComponent(user.memberId)}/tickets`),
      fintrackApi("/payments"),
      fintrackApi("/winners"),
      fintrackApi("/notifications")
    ]);
    return {
      user,
      member: memberResponse.member || null,
      tickets: ticketResponse.tickets || [],
      payments: paymentResponse.payments || [],
      winners: winnerResponse.winners || [],
      notifications: notificationResponse.notifications || []
    };
  };

  window.renderShell = (active, title, subtitle = "") => {
    const user = currentUser() || {};
    const name = user.fullName || user.username || "Member";
    const initial = String(name).trim().charAt(0).toUpperCase() || "M";
    const nav = [
      ["dashboard", "🏠", "Dashboard", "user-dashboard.html"],
      ["schemes", "📋", "My Schemes", "user-schemes.html"],
      ["payments", "💳", "My Payments", "user-payments.html"],
      ["notifications", "🔔", "Notifications", "user-notifications.html"]
    ];
    document.body.innerHTML = `<div class="app-shell">
      <aside class="sidebar"><a class="logo" href="user-dashboard.html"><span class="logo-icon">₹</span><span class="logo-text">FinTrack</span></a>
        <nav class="sidebar-nav" aria-label="Member navigation">${nav.map(([key, icon, label, href]) => `<a class="nav-item ${active === key ? "active" : ""}" href="${href}" ${active === key ? 'aria-current="page"' : ""}><span class="nav-icon">${icon}</span><span>${label}</span></a>`).join("")}</nav>
        <button class="nav-item sidebar-logout" type="button" onclick="logoutFintrack()"><span class="nav-icon">↩</span><span>Logout</span></button>
      </aside>
      <main class="main-content">
        <header class="top-header"><div class="header-left"><div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div></div>
          <div class="header-right"><div class="profile-host"><button class="user-header" type="button" aria-label="Member account"><span class="user-avatar">${esc(initial)}</span><span class="header-user-info"><strong>${esc(name)}</strong><span>Member</span></span></button><button class="profile-menu-button" type="button" aria-label="Open account menu" aria-expanded="false"><span>⋮</span></button><div class="profile-menu"><button class="profile-menu-item danger" type="button" onclick="logoutFintrack()"><span class="profile-menu-icon">↩</span>Sign out</button></div></div></div>
        </header>
        <section id="pageContent" class="page-content" aria-live="polite"></section>
      </main></div>`;
    const menuButton = document.querySelector(".profile-menu-button");
    const menu = document.querySelector(".profile-menu");
    menuButton?.addEventListener("click", () => {
      const open = menu.classList.toggle("show");
      menuButton.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", event => {
      if (!event.target.closest(".profile-host")) {
        menu?.classList.remove("show");
        menuButton?.setAttribute("aria-expanded", "false");
      }
    });
  };
})();
