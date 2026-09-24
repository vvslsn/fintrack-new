(() => {
  "use strict";
  const API_BASE = (window.FINTRACK_API_URL || "http://localhost:5000/api").replace(/\/$/,"");
  const TOKEN_KEY="fintrackToken";
  function token(){return sessionStorage.getItem(TOKEN_KEY)||"";}
  async function api(path,options={}){
    const headers={"Content-Type":"application/json",...(options.headers||{})};
    const t=token(); if(t) headers.Authorization=`Bearer ${t}`;
    const res=await fetch(API_BASE+path,{...options,headers});
    let data={}; try{data=await res.json();}catch{}
    if(res.status===401){sessionStorage.clear(); if(!/login|signup|forgot/i.test(location.pathname)) location.href=location.pathname.includes("/user/")?"user-login.html":"admin-login.html";}
    if(!res.ok) throw new Error(data.message||`Request failed (${res.status})`);
    return data;
  }
  function setSession(data){sessionStorage.setItem(TOKEN_KEY,data.token);sessionStorage.setItem("currentUser",JSON.stringify(data.user));sessionStorage.setItem("loggedIn","true");}
  function clearSession(){sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem("currentUser");sessionStorage.removeItem("loggedIn");localStorage.removeItem(TOKEN_KEY);}
  window.fintrackApi=api; window.fintrackSetSession=setSession; window.fintrackClearSession=clearSession; window.FINTRACK_API_BASE=API_BASE;
})();