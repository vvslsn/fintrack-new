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
    const [memberResponse, paymentResponse, winnerResponse, notificationResponse] = await Promise.all([
      fintrackApi("/members"),
      fintrackApi("/payments"),
      fintrackApi("/winners"),
      fintrackApi("/notifications")
    ]);
    const members = memberResponse.members || [];
    const ticketResponses = await Promise.all(members.map(member => fintrackApi(`/members/${encodeURIComponent(member.id || member._id)}/tickets`)));
    return {
      user,
      member: members.find(member => String(member.id || member._id) === String(user.memberId)) || members[0] || null,
      members,
      tickets: ticketResponses.flatMap(response => response.tickets || []),
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
          <div class="header-right"><div class="profile-host"><button class="user-header" type="button" aria-label="Member account"><span class="user-avatar">${esc(initial)}</span><span class="header-user-info"><strong>${esc(name)}</strong><span>Member</span></span></button><button class="profile-menu-button" type="button" aria-label="Open account menu" aria-expanded="false"><span>⋮</span></button><div class="profile-menu" role="menu"><button class="profile-menu-item" type="button" role="menuitem" data-user-profile-action="edit"><span class="profile-menu-icon">✎</span>Edit Profile</button><button class="profile-menu-item" type="button" role="menuitem" data-user-profile-action="password"><span class="profile-menu-icon">🔒</span>Change Password</button></div></div></div>
        </header>
        <section id="pageContent" class="page-content" aria-live="polite"></section>
      </main></div>
      <div class="user-modal-overlay" id="memberProfileModal" role="dialog" aria-modal="true" aria-labelledby="memberProfileTitle"><section class="user-modal"><div class="user-modal-header"><h2 id="memberProfileTitle">Edit Profile</h2><button class="user-modal-close" type="button" data-close-user-modal aria-label="Close">×</button></div><form class="user-modal-form" id="memberProfileForm"><label for="memberProfileName">Name</label><input id="memberProfileName" name="fullName" type="text" autocomplete="name" maxlength="100" required><label for="memberProfileEmail">Email</label><input id="memberProfileEmail" name="email" type="email" autocomplete="email" maxlength="160" required><label for="memberProfilePhone">Phone number</label><input id="memberProfilePhone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" pattern="[0-9]{10}" maxlength="10" required><p class="user-profile-message" id="memberProfileMessage" role="status"></p><div class="user-modal-footer"><button class="modal-cancel" type="button" data-close-user-modal>Cancel</button><button class="modal-save" type="submit">Save Changes</button></div></form></section></div>
      <div class="user-modal-overlay" id="memberPasswordModal" role="dialog" aria-modal="true" aria-labelledby="memberPasswordTitle"><section class="user-modal"><div class="user-modal-header"><h2 id="memberPasswordTitle">Change Password</h2><button class="user-modal-close" type="button" data-close-user-modal aria-label="Close">×</button></div><form class="user-modal-form" id="memberPasswordForm"><label for="memberCurrentPassword">Current password</label><input id="memberCurrentPassword" name="currentPassword" type="password" autocomplete="current-password" required><label for="memberNewPassword">New password</label><input id="memberNewPassword" name="newPassword" type="password" autocomplete="new-password" minlength="8" required><label for="memberConfirmPassword">Confirm new password</label><input id="memberConfirmPassword" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required><p class="user-profile-message" id="memberPasswordMessage" role="status"></p><div class="user-modal-footer"><button class="modal-cancel" type="button" data-close-user-modal>Cancel</button><button class="modal-save" type="submit">Update Password</button></div></form></section></div>`;
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
    const profileModal = document.getElementById("memberProfileModal");
    const passwordModal = document.getElementById("memberPasswordModal");
    const closeMenu = () => {
      menu?.classList.remove("show");
      menuButton?.setAttribute("aria-expanded", "false");
    };
    document.querySelector('[data-user-profile-action="edit"]')?.addEventListener("click", () => {
      closeMenu();
      const user = currentUser() || {};
      document.getElementById("memberProfileName").value = user.fullName || "";
      document.getElementById("memberProfileEmail").value = user.email || "";
      document.getElementById("memberProfilePhone").value = user.phone || "";
      document.getElementById("memberProfileMessage").textContent = "";
      profileModal?.classList.add("show");
    });
    document.querySelector('[data-user-profile-action="password"]')?.addEventListener("click", () => {
      closeMenu();
      document.getElementById("memberPasswordForm")?.reset();
      document.getElementById("memberPasswordMessage").textContent = "";
      passwordModal?.classList.add("show");
    });
    document.querySelectorAll("[data-close-user-modal]").forEach(button => button.addEventListener("click", () => {
      profileModal?.classList.remove("show");
      passwordModal?.classList.remove("show");
    }));
    [profileModal, passwordModal].forEach(modal => modal?.addEventListener("click", event => {
      if (event.target === modal) modal.classList.remove("show");
    }));
    document.querySelector("#memberProfileForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('[type="submit"]');
      const message = document.getElementById("memberProfileMessage");
      const payload = {
        fullName: document.getElementById("memberProfileName").value.trim(),
        email: document.getElementById("memberProfileEmail").value.trim(),
        phone: document.getElementById("memberProfilePhone").value.trim()
      };
      submit.disabled = true;
      message.textContent = "Saving profile…";
      try {
        const result = await fintrackApi("/auth/profile", { method: "PATCH", body: JSON.stringify(payload) });
        sessionStorage.setItem("currentUser", JSON.stringify(result.user));
        const updatedName = result.user.fullName || result.user.username || "Member";
        document.querySelector(".header-user-info strong").textContent = updatedName;
        document.querySelector(".user-avatar").textContent = updatedName.trim().charAt(0).toUpperCase() || "M";
        profileModal?.classList.remove("show");
      } catch (error) {
        message.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });
    document.querySelector("#memberPasswordForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const currentPassword = document.getElementById("memberCurrentPassword").value;
      const newPassword = document.getElementById("memberNewPassword").value;
      const confirmPassword = document.getElementById("memberConfirmPassword").value;
      const message = document.getElementById("memberPasswordMessage");
      const submit = event.currentTarget.querySelector('[type="submit"]');
      if (newPassword !== confirmPassword) { message.textContent = "New passwords do not match."; return; }
      submit.disabled = true;
      message.textContent = "Updating password…";
      try {
        await fintrackApi("/auth/password", { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword }) });
        passwordModal?.classList.remove("show");
      } catch (error) {
        message.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });
  };
})();
