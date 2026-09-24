document.addEventListener("DOMContentLoaded",()=>{
 const form=document.getElementById("loginForm"),msg=document.getElementById("loginMessage");
 form?.addEventListener("submit",async e=>{e.preventDefault();msg.textContent="Signing in...";
  try{const data=await fintrackApi("/auth/admin/login",{method:"POST",body:JSON.stringify({username:username.value.trim(),password:password.value})});fintrackSetSession(data);msg.textContent="Login successful.";location.href="dashboard.html";}
  catch(err){msg.textContent=err.message;msg.className="message error";}
 });
 document.getElementById("togglePassword")?.addEventListener("click",()=>{password.type=password.type==="password"?"text":"password"});
});