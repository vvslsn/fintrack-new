document.addEventListener("DOMContentLoaded",()=>{
 const f=document.getElementById("loginForm")||document.getElementById("userLoginForm"),msg=document.getElementById("loginMessage");
 const passwordInput=document.getElementById("password"),togglePassword=document.getElementById("togglePassword");
 togglePassword?.addEventListener("click",()=>{
  const showing=passwordInput.type==="password";
  passwordInput.type=showing?"text":"password";
  togglePassword.setAttribute("aria-label",showing?"Hide password":"Show password");
  togglePassword.setAttribute("aria-pressed",String(showing));
 });
 f?.addEventListener("submit",async e=>{e.preventDefault();const identifier=document.getElementById("identifier")?.value.trim()||document.getElementById("email")?.value.trim()||document.getElementById("username")?.value.trim(),password=document.getElementById("password").value;try{const d=await fintrackApi("/auth/user/login",{method:"POST",body:JSON.stringify({identifier,password})});fintrackSetSession(d);sessionStorage.setItem("fintrackActivePortal","member");if(d.user.mustChangePassword){location.href="user-change-password.html";return;}msg.textContent="Login successful.";location.href="user-dashboard.html";}catch(err){msg.textContent=err.message;msg.className="message error";}});
});
