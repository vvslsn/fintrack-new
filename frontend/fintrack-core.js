(() => {
 "use strict";
 window.escHtml=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
 window.money=v=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v)||0);
 window.dateText=v=>{if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});}
 window.normalizeChitType=v=>String(v||"cash").toLowerCase().includes("gold")?"gold":"cash";
 window.fintrackPaymentAmount=(s,month,member,ticket)=>{
   const m=Number(month); if(window.normalizeChitType(s?.chitType||s?.type)==="gold"){const x=s.goldMonthlyInstallments||{};const hasSchedule=x instanceof Map?x.size>0:Object.keys(x).length>0;return Number(x[String(m)]??x[m]??(hasSchedule?0:s.baseAmount)??0)||0;}
   const total=Number(s?.totalAmount||0); if(!total)return Number(s?.baseAmount||0)||0;
   const win=Number(ticket?.winningMonth||member?.winningMonth||0); return Math.round(total*((win>0&&m>=win)?.06:.05));
 };
 window.fintrackWinnerPayout=(s,month)=>window.normalizeChitType(s?.chitType||s?.type)==="gold"?0:Math.round(Number(s?.totalAmount||0)*.95);
 window.logoutFintrack=()=>{fintrackClearSession();location.href=location.pathname.includes("/user/")?"user-login.html":"admin-login.html";};
 window.generateFintrackUniqueId=(p="FT")=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
 window.getFintrackDueDate=(scheme,month)=>{
   if(!scheme?.startDate)return null;
   const start=new Date(scheme.startDate),m=Number(month);
   if(Number.isNaN(start.getTime())||!Number.isInteger(m)||m<1)return null;
   const day=start.getUTCDate(),base=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+m-1,1));
   const monthDays=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+1,0)).getUTCDate();
   const due=day===1?10:Math.min(day,monthDays)+10;
   return new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),due));
 };
 window.getFintrackGraceEndDate=(scheme,month)=>{
   const due=window.getFintrackDueDate(scheme,month);
   if(!due)return null;
   return due;
 };
 window.isFintrackOverdue=(scheme,month,now=new Date())=>{
   const end=window.getFintrackGraceEndDate(scheme,month);
   if(!end)return false;
   const key=date=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
   return key(now)>key(end);
 };
 window.isFintrackInGracePeriod=(scheme,month,now=new Date())=>{
   const due=window.getFintrackDueDate(scheme,month),end=window.getFintrackGraceEndDate(scheme,month);
   if(!due||!end)return false;
   const key=date=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
   return key(now)>key(due)&&key(now)<=key(end);
 };
})();
