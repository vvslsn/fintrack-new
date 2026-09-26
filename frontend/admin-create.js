"use strict";
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("adminCreateForm");
  const message = document.getElementById("adminCreateMessage");
  try {
    const session = await fintrackApi("/auth/me");
    if (!["manager", "admin"].includes(session.user?.role)) throw new Error("Only a manager can create another manager account.");
  } catch (error) {
    message.textContent = error.message;
    form.querySelectorAll("input,button").forEach(field => { field.disabled = true; });
    return;
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const password = document.getElementById("adminPassword").value;
    const confirmPassword = document.getElementById("adminPasswordConfirm").value;
    const submit = document.getElementById("adminCreateSubmit");
    if (password !== confirmPassword) { message.textContent = "Passwords do not match."; return; }
    submit.disabled = true;
    message.textContent = "Creating account…";
    try {
      const result = await fintrackApi("/auth/managers", { method: "POST", body: JSON.stringify({
        fullName: document.getElementById("adminFullName").value.trim(),
        username: document.getElementById("adminUsername").value.trim(),
        email: document.getElementById("adminEmail").value.trim(),
        phone: document.getElementById("adminPhone").value.trim(),
        password, confirmPassword
      }) });
      message.textContent = `${result.user.fullName} can now sign in as a manager.`;
      form.reset();
    } catch (error) { message.textContent = error.message; }
    finally { submit.disabled = false; }
  });
});
