"use strict";

function getAdminSession() {
    try { return JSON.parse(sessionStorage.getItem("currentUser") || "null"); }
    catch { return null; }
}

let adminProfilePhotoValue = "";
let adminProfilePhotoChanged = false;

function installAdminProfileMenu() {
    const user = getAdminSession();
    document.querySelectorAll("#profileName, #headerUserName, #welcomeName").forEach(node => {
        if (user) node.textContent = user.fullName || user.username || node.textContent;
    });

    const sidebar = document.querySelector(".sidebar");
    const nav = sidebar?.querySelector(".sidebar-nav");
    if (nav && !nav.querySelector('a[href="payment-settings.html"]')) {
        const settingsLink = document.createElement("a");
        settingsLink.href = "payment-settings.html";
        settingsLink.className = `nav-item${location.pathname.endsWith("payment-settings.html") ? " active" : ""}`;
        settingsLink.innerHTML = '<span class="nav-icon">🏦</span><span>Payment Settings</span>';
        nav.append(settingsLink);
    }
    if (sidebar && !sidebar.querySelector(".sidebar-logout")) {
        const logoutButton = document.createElement("button");
        logoutButton.type = "button";
        logoutButton.className = "nav-item sidebar-logout";
        logoutButton.innerHTML = '<span class="nav-icon">↩</span><span>Logout</span>';
        logoutButton.addEventListener("click", () => logoutFintrack());
        sidebar.append(logoutButton);
    }

    const header = document.querySelector(".header-right, .topbar-right");
    if (header && !header.querySelector(".profile-menu-host")) {
        const host = document.createElement("div");
        host.className = "profile-menu-host";
        host.innerHTML = `<button class="profile-menu-button" type="button" aria-label="Open profile menu" aria-expanded="false"><span>⋮</span></button>
            <div class="profile-menu" role="menu">
                <button class="profile-menu-item" type="button" role="menuitem" data-profile-action="edit"><span class="profile-menu-icon">👤</span>Edit Profile</button>
                <button class="profile-menu-item" type="button" role="menuitem" data-profile-action="password"><span class="profile-menu-icon">🔒</span>Change Password</button>
                <a class="profile-menu-item" role="menuitem" href="admin-create.html"><span class="profile-menu-icon">＋</span>Create Manager</a>
            </div>`;
        header.append(host);
        const button = host.querySelector(".profile-menu-button");
        const menu = host.querySelector(".profile-menu");
        button.addEventListener("click", () => {
            const open = menu.classList.toggle("show");
            button.setAttribute("aria-expanded", String(open));
        });
        host.querySelector('[data-profile-action="edit"]').addEventListener("click", () => {
            menu.classList.remove("show");
            button.setAttribute("aria-expanded", "false");
            openUserEditProfile();
        });
        host.querySelector('[data-profile-action="password"]').addEventListener("click", () => {
            menu.classList.remove("show");
            button.setAttribute("aria-expanded", "false");
            openChangePassword();
        });
        document.addEventListener("click", event => {
            if (!host.contains(event.target)) {
                menu.classList.remove("show");
                button.setAttribute("aria-expanded", "false");
            }
        });
    }

    if (!document.getElementById("adminProfileEditModal")) {
        document.body.insertAdjacentHTML("beforeend", `<div class="profile-menu-modal-overlay" id="adminProfileEditModal" aria-hidden="true">
            <section class="profile-menu-modal" role="dialog" aria-modal="true" aria-labelledby="adminProfileTitle">
                <header class="profile-menu-modal-header"><div><h2 id="adminProfileTitle">Edit Profile</h2><p class="profile-modal-subtitle">Update your account details and profile photo.</p></div><button class="profile-menu-close" type="button" data-close-profile aria-label="Close">×</button></header>
                <form id="adminProfileForm" class="profile-menu-form">
                    <div class="admin-profile-photo-row"><div class="admin-profile-photo-preview" id="adminProfilePhotoPreview">A</div><div class="admin-profile-photo-controls"><label class="admin-photo-upload" for="adminProfilePhotoInput">Choose profile photo</label><input id="adminProfilePhotoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden><button class="admin-photo-remove" id="adminProfilePhotoRemove" type="button">Remove photo</button><small>PNG, JPG or WebP. Images are resized before saving.</small></div></div>
                    <label for="adminProfileName">Name</label><input id="adminProfileName" name="fullName" type="text" autocomplete="name" maxlength="100" required>
                    <label for="adminProfilePhone">Phone number</label><input id="adminProfilePhone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" pattern="[0-9]{10}" maxlength="10" required>
                    <label for="adminProfileEmail">Email ID</label><input id="adminProfileEmail" name="email" type="email" autocomplete="email" maxlength="160" required>
                    <p class="profile-modal-message" id="adminProfileMessage" role="status"></p>
                    <footer class="profile-menu-modal-footer"><button class="profile-menu-cancel" type="button" data-close-profile>Cancel</button><button class="profile-menu-save" id="adminProfileSave" type="submit">Save Changes</button></footer>
                </form>
            </section></div>
            <div class="profile-menu-modal-overlay" id="adminPasswordModal" aria-hidden="true">
            <section class="profile-menu-modal password-dialog" role="dialog" aria-modal="true" aria-labelledby="adminPasswordTitle">
                <header class="profile-menu-modal-header"><div><h2 id="adminPasswordTitle">Change Password</h2><p class="profile-modal-subtitle">Choose a new password for your account.</p></div><button class="profile-menu-close" type="button" data-close-password aria-label="Close">×</button></header>
                <form id="adminPasswordForm" class="profile-menu-form">
                    <label for="adminCurrentPassword">Current password</label><input id="adminCurrentPassword" name="currentPassword" type="password" autocomplete="current-password" required>
                    <label for="adminNewPassword">New password</label><input id="adminNewPassword" name="newPassword" type="password" autocomplete="new-password" minlength="8" required>
                    <label for="adminConfirmPassword">Confirm new password</label><input id="adminConfirmPassword" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required>
                    <p class="profile-modal-message" id="adminPasswordMessage" role="status"></p>
                    <footer class="profile-menu-modal-footer"><button class="profile-menu-cancel" type="button" data-close-password>Cancel</button><button class="profile-menu-save" id="adminPasswordSave" type="submit">Update Password</button></footer>
                </form>
            </section></div>`);
    }

    bindAdminProfileDialogs();
    updateAdminAvatar(user);
}

function updateAdminAvatar(user) {
    const name = user?.fullName || user?.username || "Manager";
    const avatar = document.getElementById("headerAvatar") || document.getElementById("profileAvatar");
    if (!avatar) return;
    if (user?.profilePhoto) {
        avatar.classList.add("has-photo");
        const image = document.createElement("img");
        image.src = user.profilePhoto;
        image.alt = `${name} profile photo`;
        avatar.replaceChildren(image);
    } else {
        avatar.classList.remove("has-photo");
        avatar.textContent = name.trim().charAt(0).toUpperCase() || "A";
    }
}

function showAdminDialog(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("profile-dialog-open");
}

function closeAdminDialog(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".profile-menu-modal-overlay.show")) document.body.classList.remove("profile-dialog-open");
}

window.openUserEditProfile = () => {
    const user = getAdminSession();
    if (!user) return;
    document.getElementById("adminProfileName").value = user.fullName || "";
    document.getElementById("adminProfilePhone").value = user.phone || "";
    document.getElementById("adminProfileEmail").value = user.email || "";
    document.getElementById("adminProfileMessage").textContent = "";
    adminProfilePhotoValue = user.profilePhoto || "";
    adminProfilePhotoChanged = false;
    setAdminPhotoPreview(user.profilePhoto || "", user.fullName || user.username || "Manager");
    showAdminDialog("adminProfileEditModal");
};

window.openChangePassword = () => {
    document.getElementById("adminPasswordForm")?.reset();
    document.getElementById("adminPasswordMessage").textContent = "";
    showAdminDialog("adminPasswordModal");
};

function setAdminPhotoPreview(source, name = "Admin") {
    const preview = document.getElementById("adminProfilePhotoPreview");
    if (!preview) return;
    if (!source) { preview.textContent = String(name).trim().charAt(0).toUpperCase() || "A"; return; }
    const image = document.createElement("img");
    image.src = source;
    image.alt = "Profile photo preview";
    preview.replaceChildren(image);
}

function resizeAdminProfilePhoto(file) {
    return new Promise((resolve, reject) => {
        if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return reject(new Error("Choose a JPG, PNG or WebP image."));
        if (file.size > 8 * 1024 * 1024) return reject(new Error("Choose an image smaller than 8 MB."));
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read that image."));
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => reject(new Error("Could not open that image."));
            image.onload = () => {
                const max = 640;
                const scale = Math.min(1, max / Math.max(image.width, image.height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.82));
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function bindAdminProfileDialogs() {
    document.querySelectorAll("[data-close-profile]").forEach(button => button.addEventListener("click", () => closeAdminDialog("adminProfileEditModal")));
    document.querySelectorAll("[data-close-password]").forEach(button => button.addEventListener("click", () => closeAdminDialog("adminPasswordModal")));
    ["adminProfileEditModal", "adminPasswordModal"].forEach(id => document.getElementById(id)?.addEventListener("click", event => {
        if (event.target.id === id) closeAdminDialog(id);
    }));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") ["adminProfileEditModal", "adminPasswordModal"].forEach(closeAdminDialog);
    });

    document.getElementById("adminProfilePhotoInput")?.addEventListener("change", async event => {
        const message = document.getElementById("adminProfileMessage");
        message.textContent = "";
        try {
            adminProfilePhotoValue = await resizeAdminProfilePhoto(event.target.files?.[0]);
            adminProfilePhotoChanged = true;
            setAdminPhotoPreview(adminProfilePhotoValue);
        } catch (error) { message.textContent = error.message; event.target.value = ""; }
    });
    document.getElementById("adminProfilePhotoRemove")?.addEventListener("click", () => {
        adminProfilePhotoValue = "";
        adminProfilePhotoChanged = true;
        document.getElementById("adminProfilePhotoInput").value = "";
        setAdminPhotoPreview("", document.getElementById("adminProfileName").value || "Manager");
    });
    document.getElementById("adminProfileForm")?.addEventListener("submit", async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const message = document.getElementById("adminProfileMessage");
        const save = document.getElementById("adminProfileSave");
        if (!form.reportValidity()) return;
        save.disabled = true;
        message.textContent = "Saving your profile…";
        const existingPhoto = getAdminSession()?.profilePhoto || "";
        try {
            const result = await fintrackApi("/auth/profile", {
                method: "PATCH",
                body: JSON.stringify({
                    fullName: document.getElementById("adminProfileName").value.trim(),
                    phone: document.getElementById("adminProfilePhone").value.trim(),
                    email: document.getElementById("adminProfileEmail").value.trim(),
                    profilePhoto: adminProfilePhotoChanged ? adminProfilePhotoValue : existingPhoto
                })
            });
            sessionStorage.setItem("currentUser", JSON.stringify(result.user));
            document.querySelectorAll("#profileName, #headerUserName, #welcomeName").forEach(node => { node.textContent = result.user.fullName || result.user.username; });
            updateAdminAvatar(result.user);
            closeAdminDialog("adminProfileEditModal");
            adminProfilePhotoChanged = false;
        } catch (error) { message.textContent = error.message; }
        finally { save.disabled = false; }
    });
    document.getElementById("adminPasswordForm")?.addEventListener("submit", async event => {
        event.preventDefault();
        const currentPassword = document.getElementById("adminCurrentPassword").value;
        const newPassword = document.getElementById("adminNewPassword").value;
        const confirmPassword = document.getElementById("adminConfirmPassword").value;
        const message = document.getElementById("adminPasswordMessage");
        const save = document.getElementById("adminPasswordSave");
        if (newPassword.length < 8) { message.textContent = "New password must contain at least 8 characters."; return; }
        if (newPassword !== confirmPassword) { message.textContent = "New password and confirmation do not match."; return; }
        save.disabled = true;
        message.textContent = "Updating your password…";
        try {
            await fintrackApi("/auth/password", { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword }) });
            closeAdminDialog("adminPasswordModal");
            document.getElementById("adminPasswordForm").reset();
            alert("Password changed successfully.");
        } catch (error) { message.textContent = error.message; }
        finally { save.disabled = false; }
    });
}

window.logout = () => logoutFintrack();
document.addEventListener("DOMContentLoaded", installAdminProfileMenu);
