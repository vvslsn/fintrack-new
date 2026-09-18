"use strict";

/* =========================================================
   FINTRACK - PROFILE THREE-DOT MENU
   Adds: Edit Profile / Change Password / Logout
========================================================= */

(function () {
    const MENU_ID = "fintrackProfileMenu";
    const MODAL_ID = "fintrackProfileEditorModal";
    const PASSWORD_MODAL_ID = "fintrackPasswordModal";

    function getCurrentUser() {
        try {
            const saved = localStorage.getItem("fintrackUser");
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error("Unable to load profile:", error);
            return null;
        }
    }

    function saveCurrentUser(user) {
        localStorage.setItem("fintrackUser", JSON.stringify(user));

        try {
            const accounts = JSON.parse(
                localStorage.getItem("fintrackAccounts") || "[]"
            );

            if (Array.isArray(accounts) && user.username) {
                const updated = accounts.map(account =>
                    String(account.username || "").toLowerCase() ===
                    String(user.username || "").toLowerCase()
                        ? { ...account, ...user }
                        : account
                );
                localStorage.setItem(
                    "fintrackAccounts",
                    JSON.stringify(updated)
                );
            }
        } catch (error) {
            console.warn("Could not update account list:", error);
        }

        sessionStorage.setItem("currentUser", JSON.stringify(user));

        window.dispatchEvent(
            new CustomEvent("fintrack:profile-updated", {
                detail: user
            })
        );
    }

    function getInitial(user) {
        const value = String(
            user?.fullName || user?.name || user?.username || "U"
        ).trim();
        return value ? value.charAt(0).toUpperCase() : "U";
    }

    function addMenuButton() {
        if (document.getElementById(MENU_ID + "Button")) return;

        const host =
            document.querySelector(".topbar-right") ||
            document.querySelector(".header-right");

        if (!host) return;

        const button = document.createElement("button");
        button.type = "button";
        button.id = MENU_ID + "Button";
        button.className = "profile-menu-button";
        button.setAttribute("aria-label", "Profile menu");
        button.setAttribute("aria-haspopup", "true");
        button.setAttribute("aria-expanded", "false");
        button.innerHTML = "<span aria-hidden=\"true\">⋮</span>";

        host.appendChild(button);

        button.addEventListener("click", function (event) {
            event.stopPropagation();
            toggleMenu();
        });
    }

    function createMenu() {
        if (document.getElementById(MENU_ID)) return;

        const host =
            document.querySelector(".topbar-right") ||
            document.querySelector(".header-right");

        if (!host) return;

        const menu = document.createElement("div");
        menu.id = MENU_ID;
        menu.className = "profile-menu";
        menu.setAttribute("role", "menu");
        menu.innerHTML = `
            <button type="button" class="profile-menu-item" data-action="edit" role="menuitem">
                <span class="profile-menu-icon">✎</span>
                <span>Edit Profile</span>
            </button>
            <button type="button" class="profile-menu-item" data-action="password" role="menuitem">
                <span class="profile-menu-icon">🔒</span>
                <span>Change Password</span>
            </button>
            <div class="profile-menu-divider"></div>
            <button type="button" class="profile-menu-item danger" data-action="logout" role="menuitem">
                <span class="profile-menu-icon">↪</span>
                <span>Logout</span>
            </button>
        `;

        host.appendChild(menu);

        menu.addEventListener("click", function (event) {
            const item = event.target.closest("[data-action]");
            if (!item) return;

            closeMenu();

            const action = item.dataset.action;
            if (action === "edit") openEditProfile();
            if (action === "password") openChangePassword();
            if (action === "logout") logout();
        });
    }

    function toggleMenu() {
        const menu = document.getElementById(MENU_ID);
        const button = document.getElementById(MENU_ID + "Button");
        if (!menu || !button) return;

        const open = menu.classList.toggle("show");
        button.setAttribute("aria-expanded", String(open));
    }

    function closeMenu() {
        const menu = document.getElementById(MENU_ID);
        const button = document.getElementById(MENU_ID + "Button");
        if (menu) menu.classList.remove("show");
        if (button) button.setAttribute("aria-expanded", "false");
    }

    function ensureGenericProfileModal() {
        if (document.getElementById(MODAL_ID)) return;

        const modal = document.createElement("div");
        modal.id = MODAL_ID;
        modal.className = "profile-menu-modal-overlay";
        modal.innerHTML = `
            <div class="profile-menu-modal" role="dialog" aria-modal="true" aria-labelledby="profileMenuModalTitle">
                <div class="profile-menu-modal-header">
                    <h2 id="profileMenuModalTitle">Edit Profile</h2>
                    <button type="button" class="profile-menu-close" data-close="profile">×</button>
                </div>
                <div class="profile-menu-form">
                    <label for="menuProfileName">Name</label>
                    <input id="menuProfileName" type="text" autocomplete="name" placeholder="Your name">

                    <label for="menuProfileUsername">Username</label>
                    <input id="menuProfileUsername" type="text" readonly>

                    <label for="menuProfileEmail">Email</label>
                    <input id="menuProfileEmail" type="email" autocomplete="email" placeholder="you@example.com">

                    <label for="menuProfilePhone">Phone</label>
                    <input id="menuProfilePhone" type="tel" autocomplete="tel" placeholder="Phone number">
                </div>
                <div class="profile-menu-modal-footer">
                    <button type="button" class="profile-menu-cancel" data-close="profile">Cancel</button>
                    <button type="button" class="profile-menu-save" id="saveMenuProfile">Save Profile</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener("click", function (event) {
            if (event.target === modal || event.target.closest('[data-close="profile"]')) {
                closeGenericModal(MODAL_ID);
            }
        });

        document.getElementById("saveMenuProfile").addEventListener("click", saveMenuProfile);
    }

    function openEditProfile() {
        if (typeof window.openProfileModal === "function" && document.getElementById("profileModal")) {
            window.openProfileModal();
            return;
        }

        ensureGenericProfileModal();
        const user = getCurrentUser();
        if (!user) {
            window.location.href = "admin-login.html";
            return;
        }

        document.getElementById("menuProfileName").value =
            user.fullName || user.name || user.username || "";
        document.getElementById("menuProfileUsername").value = user.username || "";
        document.getElementById("menuProfileEmail").value = user.email || "";
        document.getElementById("menuProfilePhone").value = user.phone || "";

        showGenericModal(MODAL_ID);
    }

    function saveMenuProfile() {
        const user = getCurrentUser();
        if (!user) return;

        const name = document.getElementById("menuProfileName").value.trim();
        const email = document.getElementById("menuProfileEmail").value.trim();
        const phone = document.getElementById("menuProfilePhone").value.trim();

        if (!name) {
            alert("Please enter your name.");
            return;
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            alert("Please enter a valid email address.");
            return;
        }

        user.fullName = name;
        user.email = email;
        user.phone = phone;
        saveCurrentUser(user);
        updateVisibleProfile(user);
        closeGenericModal(MODAL_ID);
        alert("Profile updated successfully.");
    }

    function ensurePasswordModal() {
        if (document.getElementById(PASSWORD_MODAL_ID)) return;

        const modal = document.createElement("div");
        modal.id = PASSWORD_MODAL_ID;
        modal.className = "profile-menu-modal-overlay";
        modal.innerHTML = `
            <div class="profile-menu-modal" role="dialog" aria-modal="true" aria-labelledby="passwordModalTitle">
                <div class="profile-menu-modal-header">
                    <h2 id="passwordModalTitle">Change Password</h2>
                    <button type="button" class="profile-menu-close" data-close="password">×</button>
                </div>
                <div class="profile-menu-form">
                    <label for="menuCurrentPassword">Current Password</label>
                    <input id="menuCurrentPassword" type="password" autocomplete="current-password" placeholder="Enter current password">

                    <label for="menuNewPassword">New Password</label>
                    <input id="menuNewPassword" type="password" autocomplete="new-password" placeholder="At least 6 characters">

                    <label for="menuConfirmPassword">Confirm Password</label>
                    <input id="menuConfirmPassword" type="password" autocomplete="new-password" placeholder="Confirm new password">
                </div>
                <div class="profile-menu-modal-footer">
                    <button type="button" class="profile-menu-cancel" data-close="password">Cancel</button>
                    <button type="button" class="profile-menu-save" id="saveMenuPassword">Update Password</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener("click", function (event) {
            if (event.target === modal || event.target.closest('[data-close="password"]')) {
                closeGenericModal(PASSWORD_MODAL_ID);
            }
        });

        document.getElementById("saveMenuPassword").addEventListener("click", saveMenuPassword);
    }

    function openChangePassword() {
        if (typeof window.openChangePasswordModal === "function" && document.getElementById("changePasswordModal")) {
            window.openChangePasswordModal();
            return;
        }

        ensurePasswordModal();
        ["menuCurrentPassword", "menuNewPassword", "menuConfirmPassword"].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = "";
        });
        showGenericModal(PASSWORD_MODAL_ID);
    }

    async function hashPassword(password) {
        if (!window.crypto || !window.crypto.subtle) {
            throw new Error("Web Crypto API is required.");
        }
        const data = new TextEncoder().encode(password);
        const digest = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(digest))
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");
    }

    async function verifyPassword(user, password) {
        if (!user) return false;
        if (user.passwordHash) {
            return (await hashPassword(password)) === user.passwordHash;
        }
        return password === user.password;
    }

    async function saveMenuPassword() {
        const user = getCurrentUser();
        if (!user) return;

        const current = document.getElementById("menuCurrentPassword").value;
        const next = document.getElementById("menuNewPassword").value;
        const confirm = document.getElementById("menuConfirmPassword").value;

        if (!current) {
            alert("Please enter your current password.");
            return;
        }

        if (!(await verifyPassword(user, current))) {
            alert("Current password is incorrect.");
            return;
        }

        if (next.length < 6) {
            alert("New password must contain at least 6 characters.");
            return;
        }

        if (next !== confirm) {
            alert("New password and confirm password do not match.");
            return;
        }

        try {
            user.passwordHash = await hashPassword(next);
            delete user.password;
            saveCurrentUser(user);
            closeGenericModal(PASSWORD_MODAL_ID);
            alert("Password changed successfully.");
        } catch (error) {
            console.error(error);
            alert("Unable to change password. Please try again.");
        }
    }

    function showGenericModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add("show");
        document.body.classList.add("profile-modal-open");
    }

    function closeGenericModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove("show");
        if (!document.querySelector(".profile-menu-modal-overlay.show")) {
            document.body.classList.remove("profile-modal-open");
        }
    }

    function updateVisibleProfile(user) {
        const name = user.fullName || user.name || user.username || "User";
        const initial = getInitial(user);

        document.querySelectorAll("#profileName, #headerUserName").forEach(el => {
            el.textContent = name;
        });

        document.querySelectorAll("#profileAvatar, #headerAvatar").forEach(el => {
            if (user.profilePhoto) {
                el.style.backgroundImage = `url("${user.profilePhoto}")`;
                el.style.backgroundSize = "cover";
                el.style.backgroundPosition = "center";
                el.textContent = "";
            } else {
                el.style.backgroundImage = "";
                el.textContent = initial;
            }
        });
    }

    function logout() {
        try {
            sessionStorage.removeItem("loggedIn");
            sessionStorage.removeItem("currentUser");
            localStorage.removeItem("fintrackUser");
        } catch (error) {
            console.warn("Logout cleanup warning:", error);
        }

        window.location.replace("admin-login.html");
    }

    window.logout = logout;

    // Keep the profile header synchronized when the user updates it.
    window.addEventListener("storage", function (event) {
        if (event.key === "fintrackUser" && event.newValue) {
            try {
                updateVisibleProfile(JSON.parse(event.newValue));
            } catch (error) {
                console.warn("Profile sync warning:", error);
            }
        }
    });

    window.addEventListener("fintrack:profile-updated", function (event) {
        updateVisibleProfile(event.detail || getCurrentUser() || {});
    });

    document.addEventListener("click", function (event) {
        const menu = document.getElementById(MENU_ID);
        const button = document.getElementById(MENU_ID + "Button");
        if (menu && menu.classList.contains("show") &&
            !menu.contains(event.target) && event.target !== button) {
            closeMenu();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeMenu();
            closeGenericModal(MODAL_ID);
            closeGenericModal(PASSWORD_MODAL_ID);
        }
    });

    document.addEventListener("DOMContentLoaded", function () {
        addMenuButton();
        createMenu();
        updateVisibleProfile(getCurrentUser() || {});
    });
})();
