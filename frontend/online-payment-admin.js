"use strict";

const ONLINE_REQUEST_KEY = "chitfund_online_payment_requests";
function oprRead(){try{const v=JSON.parse(localStorage.getItem(ONLINE_REQUEST_KEY)||"[]");return Array.isArray(v)?v:[];}catch(e){return [];}}
function oprWrite(v){localStorage.setItem(ONLINE_REQUEST_KEY,JSON.stringify(v));}
function oprMoney(v){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v)||0);}
function oprEsc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function oprDate(v){if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?oprEsc(v):d.toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});}
function oprKey(r){return typeof window.fintrackPaymentKey==="function"?window.fintrackPaymentKey(r.memberId,r.schemeId,r.ticket,r.month):[r.memberId,r.schemeId,String(r.ticket||"").trim(),Number(r.month)||0].join("|");}
function oprLedger(){try{const v=JSON.parse(localStorage.getItem("chitfund_payments")||"[]");return Array.isArray(v)?v:[];}catch(e){return [];}}
function oprSaveLedger(v){localStorage.setItem("chitfund_payments",JSON.stringify(v));}
function oprCurrentAdmin(){try{return JSON.parse(localStorage.getItem("fintrackUser")||sessionStorage.getItem("currentUser")||"null");}catch(e){return null;}}
function oprAudit(action,message,details){if(typeof window.fintrackAudit==="function")window.fintrackAudit(action,message,details);}
function oprNotify(memberId,type,message,extra){if(typeof window.fintrackNotify==="function")window.fintrackNotify(memberId,type,message,extra);else{const rows=(()=>{try{return JSON.parse(localStorage.getItem("chitfund_notifications")||"[]")}catch(e){return []}})();rows.unshift({id:`NTF-${Date.now()}`,memberId,type,message,date:new Date().toISOString(),read:false,...(extra||{})});localStorage.setItem("chitfund_notifications",JSON.stringify(rows.slice(0,2000)));}}

function renderOnlinePaymentRequests(){
  const body=document.getElementById("onlinePaymentRequestBody");
  if(!body)return;
  const all=oprRead().sort((a,b)=>String(b.submittedAt||"").localeCompare(String(a.submittedAt||"")));
  const filter=(document.getElementById("onlineRequestStatusFilter")?.value||"all").toLowerCase();
  const search=(document.getElementById("onlineRequestSearch")?.value||"").trim().toLowerCase();
  const rows=all.filter(r=>{
    if(filter!=="all"&&String(r.status||"pending").toLowerCase()!==filter)return false;
    if(!search)return true;
    return [r.memberName,r.scheme,r.ticket,r.month,r.utr,r.paymentMethod].some(v=>String(v??"").toLowerCase().includes(search));
  });
  const pending=all.filter(r=>String(r.status||"pending").toLowerCase()==="pending").length;
  const badge=document.getElementById("onlineRequestPendingCount");if(badge)badge.textContent=String(pending);
  const empty=document.getElementById("onlineRequestEmpty");
  if(!rows.length){body.innerHTML="";if(empty)empty.style.display="block";return;} if(empty)empty.style.display="none";
  body.innerHTML=rows.map(r=>{
    const st=String(r.status||"pending").toLowerCase();
    const cls=st==="approved"?"status-paid":st==="rejected"?"status-rejected":"status-pending";
    const action=st==="pending"?`<button class="opr-btn opr-review" data-id="${oprEsc(r.id)}">Review</button>`:`<button class="opr-btn opr-view" data-id="${oprEsc(r.id)}">View</button>`;
    return `<tr><td><strong>${oprEsc(r.memberName||"Member")}</strong><small>${oprEsc(r.memberEmail||"")}</small></td><td>${oprEsc(r.scheme||"—")}</td><td>#${oprEsc(r.ticket||"—")}</td><td>Month ${oprEsc(r.month||"—")}</td><td><strong>${oprMoney(r.amount)}</strong></td><td>${oprEsc(r.paymentMethod||"—")}<br><small>UTR: ${oprEsc(r.utr||"—")}</small></td><td>${oprDate(r.submittedAt)}</td><td><span class="opr-status ${cls}">${oprEsc(st)}</span></td><td>${action}</td></tr>`;
  }).join("");
}
function openOnlinePaymentReview(id){
  const r=oprRead().find(x=>String(x.id)===String(id));if(!r)return;
  const st=String(r.status||"pending").toLowerCase();
  const proof=r.proof?`<div class="opr-proof"><strong>Payment Proof</strong><a href="${r.proof}" target="_blank" rel="noopener">Open screenshot</a></div>`:`<div class="opr-proof muted">No payment screenshot was submitted.</div>`;
  const modal=document.getElementById("onlinePaymentReviewModal");if(!modal)return;
  modal.innerHTML=`<div class="opr-modal-backdrop" data-close-opr></div><div class="opr-modal-card"><button class="opr-close" data-close-opr>×</button><div class="scheme-type">ONLINE PAYMENT REQUEST</div><h2>${oprEsc(r.memberName||"Member")}</h2><div class="opr-detail-grid"><div><span>Scheme</span><b>${oprEsc(r.scheme||"—")}</b></div><div><span>Ticket</span><b>#${oprEsc(r.ticket||"—")}</b></div><div><span>Month</span><b>${oprEsc(r.month||"—")}</b></div><div><span>Amount</span><b>${oprMoney(r.amount)}</b></div><div><span>Method</span><b>${oprEsc(r.paymentMethod||"—")}</b></div><div><span>UTR</span><b>${oprEsc(r.utr||"—")}</b></div><div><span>Submitted</span><b>${oprDate(r.submittedAt)}</b></div><div><span>Status</span><b>${oprEsc(st)}</b></div></div>${proof}${st==="pending"?`<div class="opr-review-actions"><button class="opr-btn opr-reject" data-action="reject" data-id="${oprEsc(r.id)}">Reject</button><button class="opr-btn opr-approve" data-action="approve" data-id="${oprEsc(r.id)}">Approve Payment</button></div>`:`<div class="opr-reviewed-note">Reviewed ${oprDate(r.reviewedAt)}${r.reviewedBy?` by ${oprEsc(r.reviewedBy)}`:""}${r.rejectionReason?`<br>Reason: ${oprEsc(r.rejectionReason)}`:""}</div>`}</div>`;
  modal.classList.add("open");
}
function closeOnlinePaymentReview(){document.getElementById("onlinePaymentReviewModal")?.classList.remove("open");}
function approveOnlinePayment(id){
  const requests=oprRead();const index=requests.findIndex(r=>String(r.id)===String(id));if(index<0)return;
  const r=requests[index];if(String(r.status||"pending").toLowerCase()!=="pending"){alert("This request has already been reviewed.");return;}
  const key=oprKey(r);const scheme=typeof window.fintrackGetScheme==="function"?window.fintrackGetScheme(r.schemeId):null;const member=typeof window.fintrackGetMember==="function"?window.fintrackGetMember(r.memberId):null;const entry=typeof window.fintrackGetMemberTicketEntry==="function"?window.fintrackGetMemberTicketEntry(r.memberId,r.schemeId,r.ticket):null;const expected=scheme&&typeof window.fintrackPaymentAmount==="function"?Number(window.fintrackPaymentAmount(scheme,r.month,member,r.ticket)):Number(r.amount)||0;if(expected>0&&Math.abs(expected-Number(r.amount||0))>0.01){alert(`Amount mismatch. Submitted: ${oprMoney(r.amount)}\nExpected: ${oprMoney(expected)}\n\nDo not approve until the request is corrected/reviewed.`);return;}const ledger=oprLedger();let payment=ledger.find(p=>p.paymentKey===key || (String(p.memberId)===String(r.memberId)&&String(p.schemeId)===String(r.schemeId)&&String(p.ticket||"").trim()===String(r.ticket||"").trim()&&Number(p.month)===Number(r.month)));
  const alreadyPaid=ledger.find(p=>String(p.status||"").toLowerCase()==="paid" && (p.paymentKey===key || (String(p.memberId)===String(r.memberId)&&String(p.schemeId)===String(r.schemeId)&&String(p.ticket||"").trim()===String(r.ticket||"").trim()&&Number(p.month)===Number(r.month))));
  if(alreadyPaid){r.status="approved";r.reviewedAt=new Date().toISOString();r.reviewedBy=oprCurrentAdmin()?.email||oprCurrentAdmin()?.username||"admin";r.paymentId=alreadyPaid.id;requests[index]=r;oprWrite(requests);oprNotify(r.memberId,"Payment Approved",`Your payment for Month ${r.month} (${r.scheme}, Ticket #${r.ticket}) has been approved.`,{requestId:r.id,paymentId:alreadyPaid.id});oprAudit("online_payment.approved","Online payment approved; existing paid ledger record found",{requestId:r.id,paymentId:alreadyPaid.id,paymentKey:key});renderOnlinePaymentRequests();if(typeof window.refreshPayments==="function")window.refreshPayments();if(typeof window.loadPayments==="function")window.loadPayments();closeOnlinePaymentReview();alert("Payment request approved. The existing paid receipt was preserved.");return;}
  if(!payment){payment={id:typeof window.generateFintrackUniqueId==="function"?window.generateFintrackUniqueId("PAY"): `PAY-${Date.now()}`,memberId:r.memberId,member:r.memberName||"",email:r.memberEmail||"",schemeId:r.schemeId,scheme:r.scheme||"",ticket:String(r.ticket||""),month:Number(r.month),dueDate:"",amount:Number(r.amount)||0,paymentDate:new Date().toISOString().slice(0,10),method:r.paymentMethod||"Online",transactionId:r.utr||"",status:"paid",receivedByAdmin:true,receivedAt:new Date().toISOString(),createdAt:r.submittedAt||new Date().toISOString(),updatedAt:new Date().toISOString(),paymentKey:key,source:"online_payment_request",onlineRequestId:r.id};
    if(scheme&&typeof window.getFintrackDueDate==="function")payment.dueDate=window.getFintrackDueDate(scheme,r.month);
    ledger.push(payment);
  }else{
    payment.status="paid";payment.paymentDate=new Date().toISOString().slice(0,10);payment.method=r.paymentMethod||payment.method||"Online";payment.transactionId=r.utr||payment.transactionId||"";payment.amount=Number(r.amount)||Number(payment.amount)||0;payment.receivedByAdmin=true;payment.receivedAt=new Date().toISOString();payment.updatedAt=new Date().toISOString();payment.paymentKey=key;payment.source="online_payment_request";payment.onlineRequestId=r.id;
  }
  oprSaveLedger(ledger);r.status="approved";r.reviewedAt=new Date().toISOString();r.reviewedBy=oprCurrentAdmin()?.email||oprCurrentAdmin()?.username||"admin";r.paymentId=payment.id;requests[index]=r;oprWrite(requests);
  oprNotify(r.memberId,"Payment Approved",`Your payment of ${oprMoney(r.amount)} for Month ${r.month} (${r.scheme}, Ticket #${r.ticket}) has been approved.`,{requestId:r.id,paymentId:payment.id});
  oprAudit("online_payment.approved","Online payment request approved",{requestId:r.id,paymentId:payment.id,memberId:r.memberId,schemeId:r.schemeId,ticket:r.ticket,month:r.month,amount:r.amount,utr:r.utr});
  renderOnlinePaymentRequests();closeOnlinePaymentReview();alert("Payment approved and added to the official payment ledger.");
}
function rejectOnlinePayment(id){
  const requests=oprRead();const index=requests.findIndex(r=>String(r.id)===String(id));if(index<0)return;const r=requests[index];if(String(r.status||"").toLowerCase()!=="pending"){alert("This request has already been reviewed.");return;}
  const reason=prompt("Enter the reason for rejecting this payment request:","Payment could not be verified.");if(reason===null)return;if(!String(reason).trim()){alert("A rejection reason is required.");return;}
  r.status="rejected";r.rejectionReason=String(reason).trim();r.reviewedAt=new Date().toISOString();const admin=oprCurrentAdmin();r.reviewedBy=admin?.email||admin?.username||"admin";requests[index]=r;oprWrite(requests);
  oprNotify(r.memberId,"Payment Rejected",`Your payment for Month ${r.month} (${r.scheme}, Ticket #${r.ticket}) was rejected. Reason: ${r.rejectionReason}`,{requestId:r.id,rejectionReason:r.rejectionReason});
  oprAudit("online_payment.rejected","Online payment request rejected",{requestId:r.id,memberId:r.memberId,schemeId:r.schemeId,ticket:r.ticket,month:r.month,reason:r.rejectionReason});renderOnlinePaymentRequests();if(typeof window.refreshPayments==="function")window.refreshPayments();if(typeof window.loadPayments==="function")window.loadPayments();closeOnlinePaymentReview();alert("Payment request rejected and the user has been notified.");
}

document.addEventListener("DOMContentLoaded",()=>{
  renderOnlinePaymentRequests();
  document.getElementById("onlineRequestSearch")?.addEventListener("input",renderOnlinePaymentRequests);
  document.getElementById("onlineRequestStatusFilter")?.addEventListener("change",renderOnlinePaymentRequests);
  document.getElementById("onlinePaymentRequestBody")?.addEventListener("click",e=>{const id=e.target.dataset.id;if(!id)return;openOnlinePaymentReview(id);});
  document.getElementById("onlinePaymentReviewModal")?.addEventListener("click",e=>{if(e.target.matches("[data-close-opr]"))closeOnlinePaymentReview();if(e.target.dataset.action==="approve")approveOnlinePayment(e.target.dataset.id);if(e.target.dataset.action==="reject")rejectOnlinePayment(e.target.dataset.id);});
  window.addEventListener("storage",e=>{if(e.key===ONLINE_REQUEST_KEY||e.key==="chitfund_payments")renderOnlinePaymentRequests();});
});
window.renderOnlinePaymentRequests=renderOnlinePaymentRequests;
window.approveOnlinePayment=approveOnlinePayment;
window.rejectOnlinePayment=rejectOnlinePayment;
