document.addEventListener("DOMContentLoaded",()=>{
 const f=document.getElementById("loginForm")||document.getElementById("userLoginForm"),msg=document.getElementById("loginMessage");
 f?.addEventListener("submit",async e=>{e.preventDefault();const email=document.getElementById("email")?.value.trim().toLowerCase()||document.getElementById("username").value.trim().toLowerCase(),password=document.getElementById("password").value;try{const d=await fintrackApi("/auth/user/login",{method:"POST",body:JSON.stringify({email,password})});fintrackSetSession(d);sessionStorage.setItem("fintrackActivePortal","member");msg.textContent="Login successful.";location.href="user-dashboard.html";}catch(err){msg.textContent=err.message;msg.className="message error";}});
});
