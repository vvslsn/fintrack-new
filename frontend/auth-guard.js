(function () {
    "use strict";

    const loggedIn = sessionStorage.getItem("loggedIn");
    let currentUser = null;
    try {
        currentUser = JSON.parse(sessionStorage.getItem("currentUser") || localStorage.getItem("fintrackUser") || "null");
    } catch (e) {}

    const role = String(currentUser?.role || "admin").trim().toLowerCase();

    if (loggedIn !== "true" || role !== "admin") {
        sessionStorage.removeItem("loggedIn");
        sessionStorage.removeItem("currentUser");
        window.location.replace("admin-login.html");
    }
})();
