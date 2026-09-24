(async()=>{
 const token=sessionStorage.getItem("fintrackToken");
 if(!token){location.replace("admin-login.html");return;}
 try{const d=await fintrackApi("/auth/me");if(d.user.role!=="admin")throw Error();sessionStorage.setItem("currentUser",JSON.stringify(d.user));}
 catch{fintrackClearSession();location.replace("admin-login.html");}
})();