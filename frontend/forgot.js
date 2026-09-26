document.addEventListener("DOMContentLoaded",()=>{
  const requestForm=document.getElementById("forgotPasswordForm");
  const resetForm=document.getElementById("resetPasswordForm");
  const message=document.getElementById("forgotPasswordMessage");
  const emailInput=document.getElementById("resetEmail");
  const showMessage=(text,error=false)=>{message.textContent=text;message.className=`login-message${error?" error":""}`;};
  requestForm?.addEventListener("submit",async event=>{
    event.preventDefault();
    const button=document.getElementById("sendOtpButton");button.disabled=true;showMessage("Sending reset code…");
    try{const result=await fintrackApi("/auth/password/forgot",{method:"POST",body:JSON.stringify({email:emailInput.value.trim()})});showMessage(result.message||"If an account matches that email, a password reset code will arrive shortly.");resetForm.hidden=false;document.getElementById("resetOtp").focus();}
    catch(error){showMessage(error.message,true);}finally{button.disabled=false;}
  });
  resetForm?.addEventListener("submit",async event=>{
    event.preventDefault();
    const button=document.getElementById("resetSubmit");button.disabled=true;showMessage("Updating password…");
    try{const result=await fintrackApi("/auth/password/reset",{method:"POST",body:JSON.stringify({email:emailInput.value.trim(),otp:document.getElementById("resetOtp").value.trim(),newPassword:document.getElementById("resetPassword").value,confirmPassword:document.getElementById("resetConfirmPassword").value})});requestForm.hidden=true;resetForm.hidden=true;showMessage(result.message||"Password reset successfully. You can now sign in.");}
    catch(error){showMessage(error.message,true);}finally{button.disabled=false;}
  });
});
