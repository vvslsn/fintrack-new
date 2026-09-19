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

            window.location.href = "login.html";

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

