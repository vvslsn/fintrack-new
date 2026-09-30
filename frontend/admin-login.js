//  document.addEventListener("DOMContentLoaded",()=>{
//  const form=document.getElementById("loginForm"),msg=document.getElementById("loginMessage");
//  form?.addEventListener("submit",async e=>{e.preventDefault();msg.textContent="Signing in...";
//   try{const data=await fintrackApi("/auth/manager/login",{method:"POST",body:JSON.stringify({username:username.value.trim(),password:password.value})});fintrackSetSession(data);msg.textContent="Login successful.";location.href="dashboard.html";}
//   catch(err){msg.textContent=err.message;msg.className="message error";}
//  });
//  document.getElementById("togglePassword")?.addEventListener("click",()=>{password.type=password.type==="password"?"text":"password"});
// });

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("loginForm");
    const msg = document.getElementById("loginMessage");

    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const togglePassword = document.getElementById("togglePassword");

    form?.addEventListener("submit", async (e) => {

        e.preventDefault();

        msg.textContent = "Signing in...";
        msg.className = "message";

        try {

            const data = await fintrackApi("/auth/manager/login", {
                method: "POST",
                body: JSON.stringify({
                    username: usernameInput.value.trim(),
                    password: passwordInput.value
                })
            });

            fintrackSetSession(data);

            msg.textContent = "Login successful.";

            location.href = "dashboard.html";

        } catch (err) {

            console.error("Manager login error:", err);

            msg.textContent = err.message;
            msg.className = "message error";

        }

    });

    togglePassword?.addEventListener("click", () => {

        const visible = passwordInput.type === "password";
        passwordInput.type = visible ? "text" : "password";
        togglePassword.setAttribute("aria-pressed", String(visible));
        togglePassword.setAttribute("aria-label", visible ? "Hide password" : "Show password");

    });

});
