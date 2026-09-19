const signupForm = document.getElementById("signupForm");

const signupMessage = document.getElementById("signupMessage");


signupForm.addEventListener("submit", async (event) => {

    event.preventDefault();


    // ==========================================
    // GET FORM VALUES
    // ==========================================

    const fullName =
        document.getElementById("fullName").value.trim();

    const username =
        document.getElementById("newUsername").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const phone =
        document.getElementById("phone").value.trim();

    const password =
        document.getElementById("newPassword").value;

    const confirmPassword =
        document.getElementById("confirmPassword").value;


    // ==========================================
    // SEND DATA TO BACKEND
    // ==========================================
    // =================================================
            // REQUIRED FIELDS
            // =================================================

            if (
                !fullName ||
                !username ||
                !phone ||
                !email ||
                !password ||
                !confirmPassword
            ) {

                showMessage(
                    signupMessage,
                    "Please fill in all required fields.",
                    "error"
                );

                return;

            }


            // =================================================
            // PASSWORD VALIDATION
            // =================================================

            const passwordValidation =
                validatePassword(
                    password
                );


            if (
                !passwordValidation.valid
            ) {

                showMessage(
                    signupMessage,
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
                    signupMessage,
                    "Passwords do not match.",
                    "error"
                );

                return;

            }


            // =================================================
            // PHONE VALIDATION
            // =================================================

            const phonePattern =
                /^[0-9]{10}$/;


            if (
                !phonePattern.test(
                    phone
                )
            ) {

                showMessage(
                    signupMessage,
                    "Please enter a valid 10-digit phone number.",
                    "error"
                );

                return;

            }


            // =================================================
            // EMAIL VALIDATION
            // =================================================

            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


            if (
                !emailPattern.test(
                    email
                )
            ) {

                showMessage(
                    signupMessage,
                    "Please enter a valid email address.",
                    "error"
                );

                return;

            }
    try {

        signupMessage.textContent =
            "Creating account...";


        const response = await fetch(
            "http://localhost:5000/api/auth/register",
            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    fullName,

                    username,

                    email,

                    phone,

                    password,

                    confirmPassword

                })

            }
        );


        const data = await response.json();


        // ==========================================
        // RESPONSE HANDLING
        // ==========================================

        if (!response.ok) {

            signupMessage.textContent =
                data.message || "Registration failed";

            return;

        }


        signupMessage.textContent =
            data.message;


        // Clear form
        signupForm.reset();


        console.log(
            "Created Admin:",
            data.user
        );


        // Redirect after successful signup
        setTimeout(() => {

            window.location.href = "admin-login.html";

        }, 1500);


    } catch (error) {

        console.error(
            "Signup Error:",
            error
        );


        signupMessage.textContent =
            "Unable to connect to the server";

    }

});



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
