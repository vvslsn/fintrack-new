// =====================================================
// FINTRACK - SCRIPT.JS
// =====================================================

"use strict";


// =====================================================
// LOGIN
// =====================================================

const loginForm =
    document.getElementById("loginForm");


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            // =================================================
            // GET VALUES
            // =================================================

            const usernameElement =
                document.getElementById("username");

            const passwordElement =
                document.getElementById("password");

            const loginMessage =
                document.getElementById("loginMessage");

            const forgotPassword =
                document.getElementById("forgotPassword");


            const username =
                usernameElement
                    ? usernameElement.value.trim()
                    : "";

            const password =
                passwordElement
                    ? passwordElement.value
                    : "";


            // =================================================
            // GET SAVED ACCOUNTS
            // =================================================

            let accounts = getAccounts();
            let savedUser = accounts.find(
                account =>
                    String(account.username || "").trim().toLowerCase() ===
                    username.toLowerCase()
            ) || null;

            // =================================================
            // CHECK ACCOUNT
            // =================================================

            if (!savedUser) {

                if (loginMessage) {

                    loginMessage.textContent =
                        "No account found. Please create an account first.";

                    loginMessage.className =
                        "login-message error";

                }


                if (forgotPassword) {

                    forgotPassword.classList.add(
                        "show"
                    );

                }

                return;

            }


            // =================================================
            // CHECK USERNAME AND PASSWORD
            // =================================================

            const passwordMatches = await verifyStoredPassword(savedUser, password);

            if (
                username === savedUser.username &&
                passwordMatches
            ) {

                // The main FinTrack login is the Admin portal.
                // Member accounts must use the separate Member Login.
                const accountRole = String(savedUser.role || "admin").trim().toLowerCase();
                if (accountRole !== "admin") {
                    if (loginMessage) {
                        loginMessage.textContent = "This is a Member account. Please use Member Login.";
                        loginMessage.className = "login-message error";
                    }
                    return;
                }

                savedUser.role = "admin";

                // =================================================
                // UPDATE LAST LOGIN
                // =================================================

                savedUser.lastLogin =
                    new Date().toISOString();

                // Migrate legacy plaintext passwords on the next successful login.
                if (!savedUser.passwordHash) {
                    savedUser.passwordHash = await hashPassword(password);
                    delete savedUser.password;
                }

                // Keep the selected account as the active account.
                localStorage.setItem(
                    "fintrackUser",
                    JSON.stringify(savedUser)
                );

                // Update the account in the multi-account list.
                accounts = accounts.map(account =>
                    String(account.username || "").toLowerCase() ===
                    String(savedUser.username || "").toLowerCase()
                        ? savedUser
                        : account
                );
                localStorage.setItem(
                    "fintrackAccounts",
                    JSON.stringify(accounts)
                );


                // =================================================
                // CREATE LOGIN SESSION
                // =================================================

                sessionStorage.setItem(
                    "loggedIn",
                    "true"
                );


                sessionStorage.setItem(
                    "currentUser",
                    JSON.stringify(
                        savedUser
                    )
                );
                sessionStorage.setItem("fintrackActivePortal", "admin");


                // =================================================
                // SUCCESS MESSAGE
                // =================================================

                if (loginMessage) {

                    loginMessage.textContent =
                        "Login successful! Redirecting...";

                    loginMessage.className =
                        "login-message success";

                }


                // =================================================
                // HIDE FORGOT PASSWORD
                // =================================================

                if (forgotPassword) {

                    forgotPassword.classList.remove(
                        "show"
                    );

                }


                // =================================================
                // REDIRECT
                // =================================================

                setTimeout(
                    function () {

                        window.location.replace(
                            "dashboard.html"
                        );

                    },
                    800
                );


            }
            else {


                // =================================================
                // INVALID LOGIN
                // =================================================

                if (loginMessage) {

                    loginMessage.textContent =
                        "Invalid username or password.";

                    loginMessage.className =
                        "login-message error";

                }


                if (forgotPassword) {

                    forgotPassword.classList.add(
                        "show"
                    );

                }

            }

        }
    );

}





// =====================================================
// ACCOUNT STORAGE HELPERS
// =====================================================
// Supports multiple local demo accounts while keeping the existing
// fintrackUser key as the currently selected account.

function getAccounts() {

    try {

        const storedAccounts =
            localStorage.getItem("fintrackAccounts");

        if (storedAccounts) {

            const accounts = JSON.parse(storedAccounts);

            if (Array.isArray(accounts)) {
                const normalized = accounts.map(account => {
                    const copy = { ...account };
                    // Legacy accounts created by the Admin signup page had no role.
                    // Treat unlinked legacy accounts as Admin accounts.
                    if (!copy.role) copy.role = copy.memberId != null ? "user" : "admin";
                    return copy;
                });
                localStorage.setItem("fintrackAccounts", JSON.stringify(normalized));
                return ensureDefaultAdminAccount(normalized);
            }

        }

        // Migrate the previous single-account format automatically.
        const legacyUser =
            localStorage.getItem("fintrackUser");

        if (legacyUser) {

            const user = JSON.parse(legacyUser);

            if (user && typeof user === "object") {

                const migratedAccounts = [{
                    ...user,
                    role: user.role || (user.memberId != null ? "user" : "admin")
                }];

                localStorage.setItem(
                    "fintrackAccounts",
                    JSON.stringify(migratedAccounts)
                );

                return ensureDefaultAdminAccount(migratedAccounts);
            }
        }

    }
    catch (error) {

        console.error(
            "Unable to read account list:",
            error
        );

    }

    return ensureDefaultAdminAccount([]);
}


// =====================================================
// DEFAULT ADMIN ACCOUNT
// =====================================================
// Adds the requested demo/admin account once if it does not already exist.
// The password is stored only as a SHA-256 hash in this browser demo.
function ensureDefaultAdminAccount(accounts) {

    const list = Array.isArray(accounts) ? accounts : [];

    const adminExists = list.some(account =>
        String(account.username || "").trim().toLowerCase() === "admin"
    );

    if (adminExists) {
        return list;
    }

    const adminAccount = {
        fullName: "admin",
        username: "admin",
        phone: "9999999999",
        email: "admin@gmail.com",
        passwordHash: "201bce2458f00a54130c695ca8d1658319b32206d495adf175847b57bd4a4151",
        accountCreated: new Date().toISOString(),
        lastLogin: null,
        profilePhoto: "",
        role: "admin"
    };

    list.push(adminAccount);

    try {
        localStorage.setItem(
            "fintrackAccounts",
            JSON.stringify(list)
        );
    } catch (error) {
        console.error("Unable to seed default admin account:", error);
    }

    return list;
}


// =====================================================
// PASSWORD VALIDATION
// =====================================================
//
// RULES:
// 1. Minimum 8 characters
// 2. At least one uppercase letter
// 3. At least one lowercase letter
// 4. At least one number
// 5. At least one special character
//
// IMPORTANT:
// This function is also available to
// scriptdashboard.js when loaded on the same page
// or when moved into a shared auth-utils.js file.
// =====================================================

function validatePassword(
    password
) {

    password =
        String(
            password || ""
        );


    const hasLength =
        password.length >= 8;


    const hasUppercase =
        /[A-Z]/.test(
            password
        );


    const hasLowercase =
        /[a-z]/.test(
            password
        );


    const hasNumber =
        /[0-9]/.test(
            password
        );


    const hasSpecial =
        /[^A-Za-z0-9]/.test(
            password
        );


    // =================================================
    // LENGTH
    // =================================================

    if (!hasLength) {

        return {

            valid: false,

            message:
                "Password must contain at least 8 characters."

        };

    }


    // =================================================
    // UPPERCASE
    // =================================================

    if (!hasUppercase) {

        return {

            valid: false,

            message:
                "Password must contain at least one uppercase letter."

        };

    }


    // =================================================
    // LOWERCASE
    // =================================================

    if (!hasLowercase) {

        return {

            valid: false,

            message:
                "Password must contain at least one lowercase letter."

        };

    }


    // =================================================
    // NUMBER
    // =================================================

    if (!hasNumber) {

        return {

            valid: false,

            message:
                "Password must contain at least one number."

        };

    }


    // =================================================
    // SPECIAL CHARACTER
    // =================================================

    if (!hasSpecial) {

        return {

            valid: false,

            message:
                "Password must contain at least one special character."

        };

    }


    // =================================================
    // VALID PASSWORD
    // =================================================

    return {

        valid: true,

        message:
            "Password is strong."

    };

}


// =====================================================
// LIVE SIGNUP PASSWORD REQUIREMENTS
// =====================================================

const newPassword =
    document.getElementById(
        "newPassword"
    );


if (newPassword) {

    newPassword.addEventListener(
        "input",
        function () {

            const password =
                newPassword.value;


            updateRequirement(
                "lengthRequirement",
                password.length >= 8
            );


            updateRequirement(
                "uppercaseRequirement",
                /[A-Z]/.test(
                    password
                )
            );


            updateRequirement(
                "lowercaseRequirement",
                /[a-z]/.test(
                    password
                )
            );


            updateRequirement(
                "numberRequirement",
                /[0-9]/.test(
                    password
                )
            );


            updateRequirement(
                "specialRequirement",
                /[^A-Za-z0-9]/.test(
                    password
                )
            );

        }
    );

}


// =====================================================
// UPDATE PASSWORD REQUIREMENT
// =====================================================

function updateRequirement(
    id,
    valid
) {

    const requirement =
        document.getElementById(
            id
        );


    if (!requirement) {

        return;

    }


    const icon =
        requirement.querySelector(
            "span"
        );


    if (valid) {

        requirement.classList.add(
            "valid"
        );


        if (icon) {

            icon.textContent =
                "✓";

        }

    }
    else {

        requirement.classList.remove(
            "valid"
        );


        if (icon) {

            icon.textContent =
                "○";

        }

    }

}


// =====================================================
// SHOW / HIDE LOGIN PASSWORD
// =====================================================

const togglePassword =
    document.getElementById(
        "togglePassword"
    );


const loginPassword =
    document.getElementById(
        "password"
    );


if (
    togglePassword &&
    loginPassword
) {

    togglePassword.addEventListener(
        "click",
        function () {

            if (
                loginPassword.type ===
                "password"
            ) {

                loginPassword.type =
                    "text";


                togglePassword.textContent =
                    "🙈";


                togglePassword.setAttribute(
                    "aria-label",
                    "Hide password"
                );

            }
            else {

                loginPassword.type =
                    "password";


                togglePassword.textContent =
                    "👁";


                togglePassword.setAttribute(
                    "aria-label",
                    "Show password"
                );

            }

        }
    );

}


// =====================================================
// SHOW / HIDE SIGNUP PASSWORD
// =====================================================

const toggleNewPassword =
    document.getElementById(
        "toggleNewPassword"
    );


const signupPassword =
    document.getElementById(
        "newPassword"
    );


if (
    toggleNewPassword &&
    signupPassword
) {

    toggleNewPassword.addEventListener(
        "click",
        function () {

            if (
                signupPassword.type ===
                "password"
            ) {

                signupPassword.type =
                    "text";


                toggleNewPassword.textContent =
                    "🙈";


                toggleNewPassword.setAttribute(
                    "aria-label",
                    "Hide password"
                );

            }
            else {

                signupPassword.type =
                    "password";


                toggleNewPassword.textContent =
                    "👁";


                toggleNewPassword.setAttribute(
                    "aria-label",
                    "Show password"
                );

            }

        }
    );

}


// =====================================================
// SHOW / HIDE SIGNUP CONFIRM PASSWORD
// =====================================================

const toggleConfirmPassword =
    document.getElementById(
        "toggleConfirmPassword"
    );


const confirmPassword =
    document.getElementById(
        "confirmPassword"
    );


if (
    toggleConfirmPassword &&
    confirmPassword
) {

    toggleConfirmPassword.addEventListener(
        "click",
        function () {

            if (
                confirmPassword.type ===
                "password"
            ) {

                confirmPassword.type =
                    "text";


                toggleConfirmPassword.textContent =
                    "🙈";


                toggleConfirmPassword.setAttribute(
                    "aria-label",
                    "Hide password"
                );

            }
            else {

                confirmPassword.type =
                    "password";


                toggleConfirmPassword.textContent =
                    "👁";


                toggleConfirmPassword.setAttribute(
                    "aria-label",
                    "Show password"
                );

            }

        }
    );

}


// =====================================================
// FORGOT PASSWORD
// =====================================================

const forgotPasswordForm =
    document.getElementById(
        "forgotPasswordForm"
    );


if (forgotPasswordForm) {

    forgotPasswordForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            // =================================================
            // GET VALUES
            // =================================================

            const usernameElement =
                document.getElementById(
                    "resetUsername"
                );

            const phoneElement =
                document.getElementById(
                    "resetPhone"
                );

            const passwordElement =
                document.getElementById(
                    "resetPassword"
                );

            const confirmPasswordElement =
                document.getElementById(
                    "resetConfirmPassword"
                );

            const message =
                document.getElementById(
                    "forgotPasswordMessage"
                );


            const username =
                usernameElement
                    ? usernameElement.value.trim()
                    : "";

            const phone =
                phoneElement
                    ? phoneElement.value.trim()
                    : "";

            const password =
                passwordElement
                    ? passwordElement.value
                    : "";

            const confirmPassword =
                confirmPasswordElement
                    ? confirmPasswordElement.value
                    : "";


            // =================================================
            // GET SAVED ACCOUNTS
            // =================================================

            const accounts = getAccounts();

            const savedUser = accounts.find(
                account =>
                    String(account.username || "").trim().toLowerCase() ===
                    username.toLowerCase()
            ) || null;


            // =================================================
            // CHECK ACCOUNT
            // =================================================

            if (!savedUser) {

                showMessage(
                    message,
                    "No account found. Please create an account first.",
                    "error"
                );

                return;

            }


            // =================================================
            // CHECK USERNAME
            // =================================================

            if (
                username !==
                savedUser.username
            ) {

                showMessage(
                    message,
                    "Username does not match our records.",
                    "error"
                );

                return;

            }


            // =================================================
            // CHECK PHONE
            // =================================================

            if (
                phone !==
                savedUser.phone
            ) {

                showMessage(
                    message,
                    "Phone number does not match our records.",
                    "error"
                );

                return;

            }


            // =================================================
            // VALIDATE NEW PASSWORD
            // =================================================

            const passwordValidation =
                validatePassword(
                    password
                );


            if (
                !passwordValidation.valid
            ) {

                showMessage(
                    message,
                    passwordValidation.message,
                    "error"
                );

                return;

            }


            // =================================================
            // CONFIRM PASSWORD
            // =================================================

            if (
                password !==
                confirmPassword
            ) {

                showMessage(
                    message,
                    "Passwords do not match.",
                    "error"
                );

                return;

            }


            // =================================================
            // UPDATE PASSWORD
            // =================================================

            savedUser.passwordHash =
                await hashPassword(password);
            delete savedUser.password;


            try {

                const updatedAccounts = accounts.map(account =>
                    String(account.username || "").toLowerCase() ===
                    String(savedUser.username || "").toLowerCase()
                        ? savedUser
                        : account
                );

                localStorage.setItem(
                    "fintrackAccounts",
                    JSON.stringify(updatedAccounts)
                );

                localStorage.setItem(
                    "fintrackUser",
                    JSON.stringify(savedUser)
                );

            }
            catch (error) {

                console.error(
                    "Unable to update password:",
                    error
                );

                showMessage(
                    message,
                    "Unable to reset password. Please try again.",
                    "error"
                );

                return;

            }


            // =================================================
            // CLEAR CURRENT SESSION
            // =================================================

            sessionStorage.removeItem(
                "loggedIn"
            );


            sessionStorage.removeItem(
                "currentUser"
            );


            // =================================================
            // SUCCESS
            // =================================================

            showMessage(
                message,
                "Password reset successfully! Redirecting to login...",
                "success"
            );


            // =================================================
            // REDIRECT
            // =================================================

            setTimeout(
                function () {

                    window.location.replace(
                        "index.html"
                    );

                },
                1200
            );

        }
    );

}


// =====================================================
// LIVE FORGOT PASSWORD REQUIREMENTS
// =====================================================

const resetPassword =
    document.getElementById(
        "resetPassword"
    );


if (resetPassword) {

    resetPassword.addEventListener(
        "input",
        function () {

            const password =
                resetPassword.value;


            updateRequirement(
                "resetLengthRequirement",
                password.length >= 8
            );


            updateRequirement(
                "resetUppercaseRequirement",
                /[A-Z]/.test(
                    password
                )
            );


            updateRequirement(
                "resetLowercaseRequirement",
                /[a-z]/.test(
                    password
                )
            );


            updateRequirement(
                "resetNumberRequirement",
                /[0-9]/.test(
                    password
                )
            );


            updateRequirement(
                "resetSpecialRequirement",
                /[^A-Za-z0-9]/.test(
                    password
                )
            );

        }
    );

}


// =====================================================
// SHOW / HIDE FORGOT PASSWORD
// =====================================================

const toggleResetPassword =
    document.getElementById(
        "toggleResetPassword"
    );


if (
    toggleResetPassword &&
    resetPassword
) {

    toggleResetPassword.addEventListener(
        "click",
        function () {

            if (
                resetPassword.type ===
                "password"
            ) {

                resetPassword.type =
                    "text";


                toggleResetPassword.textContent =
                    "🙈";


                toggleResetPassword.setAttribute(
                    "aria-label",
                    "Hide password"
                );

            }
            else {

                resetPassword.type =
                    "password";


                toggleResetPassword.textContent =
                    "👁";


                toggleResetPassword.setAttribute(
                    "aria-label",
                    "Show password"
                );

            }

        }
    );

}


// =====================================================
// SHOW / HIDE FORGOT CONFIRM PASSWORD
// =====================================================

const toggleResetConfirmPassword =
    document.getElementById(
        "toggleResetConfirmPassword"
    );


const resetConfirmPassword =
    document.getElementById(
        "resetConfirmPassword"
    );


if (
    toggleResetConfirmPassword &&
    resetConfirmPassword
) {

    toggleResetConfirmPassword.addEventListener(
        "click",
        function () {

            if (
                resetConfirmPassword.type ===
                "password"
            ) {

                resetConfirmPassword.type =
                    "text";


                toggleResetConfirmPassword.textContent =
                    "🙈";


                toggleResetConfirmPassword.setAttribute(
                    "aria-label",
                    "Hide password"
                );

            }
            else {

                resetConfirmPassword.type =
                    "password";


                toggleResetConfirmPassword.textContent =
                    "👁";


                toggleResetConfirmPassword.setAttribute(
                    "aria-label",
                    "Show password"
                );

            }

        }
    );

}


// =====================================================
// REMEMBER ME
// =====================================================

const rememberMe =
    document.getElementById(
        "rememberMe"
    );


const loginUsername =
    document.getElementById(
        "username"
    );


if (
    rememberMe &&
    loginUsername
) {

    // =================================================
    // LOAD REMEMBERED USERNAME
    // =================================================

    const rememberedUsername =
        localStorage.getItem(
            "fintrackRememberedUsername"
        );


    if (rememberedUsername) {

        loginUsername.value =
            rememberedUsername;


        rememberMe.checked =
            true;

    }


    // =================================================
    // SAVE / REMOVE REMEMBERED USERNAME
    // =================================================

    loginForm?.addEventListener(
        "submit",
        function () {

            if (
                rememberMe.checked
            ) {

                localStorage.setItem(
                    "fintrackRememberedUsername",
                    loginUsername.value.trim()
                );

            }
            else {

                localStorage.removeItem(
                    "fintrackRememberedUsername"
                );

            }

        }
    );

}


// =====================================================
// MESSAGE HELPER
// =====================================================

function showMessage(
    element,
    message,
    type
) {

    if (!element) {

        return;

    }


    element.textContent =
        message;


    element.className =
        "login-message " +
        type;

}



/* =========================================================
   PASSWORD STORAGE HELPERS
   NOTE: This is only a browser-side demo. Production auth
   must move credential verification to a server.
========================================================= */

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

async function verifyStoredPassword(user, password) {
    if (!user) return false;

    if (user.passwordHash) {
        return (await hashPassword(password)) === user.passwordHash;
    }

    // Legacy migration support for existing demo accounts.
    return password === user.password;
}

/* FINTRACK GOLD CHIT RULES */
/* FINTRACK GOLD CHIT RULES
 * Gold chit quantity is defined by the scheme (for example 10 grams or 20 grams).
 * The rupee amount is entered by Admin for each month.
 */
window.GOLD_CHIT_GRAMS = 10; // Legacy default only; active schemes use scheme.goldGrams.

window.isGoldChit = function (scheme) {
    if (!scheme) return false;
    const type = String(
        scheme.chitType || scheme.type || scheme.category || ""
    ).toLowerCase();
    const name = String(scheme.name || "").toLowerCase();
    return type.includes("gold") || name.includes("gold");
};

window.getGoldChitAmount = function (payment) {
    if (!payment) return null;
    const amount = Number(
        payment.goldMonthlyAmount ??
        payment.monthlyGoldAmount ??
        payment.amount
    );
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

/* FINTRACK_TWO_CHIT_TYPES
 * Only two chit models are supported:
 * 1. Cash Chit
 * 2. Gold Chit (quantity is defined by the scheme; Admin enters monthly rupee amount)
 */
window.FINTRACK_CHIT_TYPES = Object.freeze({
    CASH: "cash",
    GOLD: "gold"
});

window.normalizeChitType = function (value) {
    const v = String(value || "").trim().toLowerCase();
    if (v === "gold" || v.includes("gold")) return "gold";
    return "cash";
};

window.getChitTypeLabel = function (value) {
    return window.normalizeChitType(value) === "gold"
        ? "Gold Chit"
        : "Cash Chit";
};

window.validateChitType = function (value) {
    const v = window.normalizeChitType(value);
    if (v !== "cash" && v !== "gold") {
        throw new Error("Chit type must be Cash Chit or Gold Chit.");
    }
    return v;
};
