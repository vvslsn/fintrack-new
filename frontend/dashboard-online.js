"use strict";
(function(){
 function countPending(){try{const v=JSON.parse(localStorage.getItem("chitfund_online_payment_requests")||"[]");return Array.isArray(v)?v.filter(r=>String(r.status||"pending").toLowerCase()==="pending").length:0;}catch(e){return 0;}}
 function refresh(){const n=countPending();const el=document.getElementById("onlinePaymentPendingCount");if(el)el.textContent=n;const nav=document.getElementById("paymentsNavBadge");if(nav){nav.textContent=n;nav.style.display=n?"inline-flex":"none";}}
 document.addEventListener("DOMContentLoaded",refresh);window.addEventListener("storage",e=>{if(e.key==="chitfund_online_payment_requests")refresh();});
})();
