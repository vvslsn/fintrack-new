    loginForm.addEventListener(
        "submit",
        async function (event) {

           event.preventDefault();


    // ==========================================
    // GET FORM VALUES
    // ==========================================

    const username =
        document.getElementById("username").value.trim();

    const password =
        document.getElementById("password").value;


    try {

        loginMessage.textContent =
            "Logging in...";


        // ==========================================
        // SEND LOGIN REQUEST
        // ==========================================

        const response = await fetch(

            "http://localhost:5000/api/auth/admin/login",

            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    username,

                    password

                })

            }

        );


        const data = await response.json();


        // ==========================================
        // HANDLE ERROR
        // ==========================================

        if (!response.ok) {

            loginMessage.textContent =
                data.message || "Login failed";

            return;

        }


        // ==========================================
        // SAVE LOGIN DATA
        // ==========================================

        sessionStorage.setItem(
            "fintrackToken",
            data.token
        );

        sessionStorage.setItem(
            "fintrackUser",
            JSON.stringify(data.user)
        );


        // ==========================================
        // SUCCESS
        // ==========================================

        loginMessage.textContent =
            data.message;


        // Redirect to admin dashboard
        setTimeout(() => {

            window.location.href =
                "dashboard.html";

        }, 1000);


    } catch (error) {

        console.error(
            "Login Error:",
            error
        );


        loginMessage.textContent =
            "Unable to connect to server";

    }

});