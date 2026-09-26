document.addEventListener("DOMContentLoaded", () => {
  let user = null;
  try { user = JSON.parse(sessionStorage.getItem("currentUser") || "null"); } catch {}
  if (!sessionStorage.getItem("fintrackToken") || user?.role !== "user") {
    location.replace("user-login.html");
    return;
  }
  if (!user.mustChangePassword) {
    location.replace("user-dashboard.html");
    return;
  }

  const form = document.getElementById("firstPasswordForm");
  const message = document.getElementById("passwordMessage");
  const submit = document.getElementById("savePassword");
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    if (newPassword.length < 8) { message.textContent = "Use at least 8 characters."; return; }
    if (newPassword !== confirmPassword) { message.textContent = "Passwords do not match."; return; }
    submit.disabled = true;
    message.textContent = "Updating password...";
    try {
      const result = await fintrackApi("/auth/password/first-login", {
        method: "POST",
        body: JSON.stringify({ newPassword, confirmPassword })
      });
      sessionStorage.setItem("currentUser", JSON.stringify(result.user));
      location.replace("user-dashboard.html");
    } catch (error) {
      message.textContent = error.message;
      submit.disabled = false;
    }
  });
});
