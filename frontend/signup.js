document.addEventListener("DOMContentLoaded",()=>{
 const f=document.getElementById("signupForm"),msg=document.getElementById("signupMessage");
 f?.addEventListener("submit",async e=>{e.preventDefault();
  const fullName=document.getElementById("fullName").value.trim(),username=document.getElementById("newUsername").value.trim(),email=document.getElementById("email").value.trim(),phone=document.getElementById("phone").value.trim(),password=document.getElementById("newPassword").value,confirmPassword=document.getElementById("confirmPassword").value;
  if(!fullName||!username||!email||!phone||!password||!confirmPassword)return msg.textContent="Please fill in all required fields.";
  if(password!==confirmPassword)return msg.textContent="Passwords do not match.";
  if(!/^\d{10}$/.test(phone))return msg.textContent="Enter a valid 10-digit phone number.";
  if(password.length<8||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/\d/.test(password)||!/[^\w]/.test(password))return msg.textContent="Password must contain 8+ chars, upper, lower, number and special character.";
  try{const d=await fintrackApi("/auth/register",{method:"POST",body:JSON.stringify({fullName,username,email,phone,password,confirmPassword})});msg.textContent=d.message;f.reset();setTimeout(()=>location.href="admin-login.html",1000);}catch(err){msg.textContent=err.message;}
 });
});