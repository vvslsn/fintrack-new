(() => {
 "use strict";
 window.escHtml=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
 window.money=v=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v)||0);
 window.dateText=v=>{if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});}
 window.normalizeChitType=v=>String(v||"cash").toLowerCase().includes("gold")?"gold":"cash";
 window.fintrackPaymentAmount=(s,month,member,ticket)=>{
   const m=Number(month); if(window.normalizeChitType(s?.chitType||s?.type)==="gold"){const x=s.goldMonthlyInstallments||{};return Number(x[String(m)]??x[m]??s.baseAmount??0)||0;}
   const total=Number(s?.totalAmount||0); if(!total)return Number(s?.baseAmount||0)||0;
   const win=Number(ticket?.winningMonth||member?.winningMonth||0); return Math.round(total*((win>0&&m>=win)?.06:.05));
 };
 window.fintrackWinnerPayout=(s,month)=>window.normalizeChitType(s?.chitType||s?.type)==="gold"?0:Math.round(Number(s?.totalAmount||0)*.95);
 window.logoutFintrack=()=>{fintrackClearSession();location.href=location.pathname.includes("/user/")?"user-login.html":"admin-login.html";};
 window.generateFintrackUniqueId=(p="FT")=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
})();