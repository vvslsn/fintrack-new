/* FinTrack shared business/data utilities - browser edition v3 */
(function () {
  "use strict";
  const KEYS = Object.freeze({
    accounts:"fintrackAccounts", user:"fintrackUser", schemes:"chitfund_schemes",
    members:"chitfund_members", payments:"chitfund_payments", winners:"chitfund_winners",
    payouts:"chitfund_admin_payouts", audit:"chitfund_audit_log",
    notifications:"chitfund_notifications", onlineRequests:"chitfund_online_payment_requests"
  });
  const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||"null");return v==null?fallback:v;}catch(e){return fallback;}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const now=()=>new Date().toISOString();
  function nextNumericId(items){return (Array.isArray(items)?items:[]).reduce((m,x)=>Math.max(m,Number(x?.id)||0),0)+1;}
  function generateFintrackId(kind){const map={scheme:KEYS.schemes,member:KEYS.members,payment:KEYS.payments,winner:KEYS.winners,payout:KEYS.payouts};return nextNumericId(read(map[kind]||KEYS.schemes,[]));}
  function uniqueId(prefix){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}
  function normalizeChitType(value){const s=String(value||"").trim().toLowerCase();return s.includes("gold")?"gold":"cash";}
  function getSchemeId(s){return s?.schemeId ?? s?.id ?? s?._id ?? null;}
  function getTicket(e){return String(e?.ticket ?? e?.ticketNumber ?? e?.ticketNo ?? "").trim();}
  function sameScheme(a,b){const ai=getSchemeId(a),bi=getSchemeId(b);if(ai!=null&&bi!=null)return String(ai)===String(bi);return String(a?.name||"").trim().toLowerCase()===String(b?.name||"").trim().toLowerCase();}
  function businessKey(memberId,schemeId,ticket,month){return [memberId,schemeId,getTicket({ticket}),Number(month)||0].map(v=>String(v??"").trim()).join("|");}
  function dueDate(scheme,month){
    if(!scheme?.startDate)return "";const m=Number(month);if(!Number.isInteger(m)||m<1)return "";
    const [y,mo,d]=String(scheme.startDate).split("-").map(Number);if(![y,mo,d].every(Number.isFinite))return "";
    const map={1:10,5:15,10:20,15:25,25:5};const dt=new Date(y,mo-1,1);dt.setMonth(dt.getMonth()+m-1);
    if(d===25){dt.setMonth(dt.getMonth()+1);dt.setDate(5);}else if(map[d])dt.setDate(map[d]);else dt.setDate(Math.min(d+10,new Date(dt.getFullYear(),dt.getMonth()+1,0).getDate()));
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
  }
  function currentDueMonth(scheme,asOf=new Date()){
    if(!scheme?.startDate)return 0;const [y,mo,d]=String(scheme.startDate).split("-").map(Number);if(![y,mo,d].every(Number.isFinite))return 0;
    const date=new Date(asOf.getFullYear(),asOf.getMonth(),asOf.getDate());let diff=(date.getFullYear()-y)*12+(date.getMonth()-(mo-1))+1;if(date.getDate()<d)diff--;return Math.max(0,diff);
  }
  function dateReached(iso,asOf=new Date()){if(!iso)return false;const [y,m,d]=String(iso).split("-").map(Number);if(![y,m,d].every(Number.isFinite))return false;return new Date(y,m-1,d).getTime()<=new Date(asOf.getFullYear(),asOf.getMonth(),asOf.getDate()).getTime();}
  function getMemberById(id){return read(KEYS.members,[]).find(m=>m&&id!=null&&String(m.id)===String(id))||null;}
  function getSchemeById(id){return read(KEYS.schemes,[]).find(s=>s&&id!=null&&String(s.id)===String(id))||null;}
  function getMemberTicketEntry(memberId,schemeId,ticket){const m=getMemberById(memberId);if(!m)return null;return (Array.isArray(m.schemes)?m.schemes:[]).find(e=>String(getSchemeId(e))===String(schemeId)&&getTicket(e)===String(ticket).trim())||null;}
  function winnerForTicket(schemeId,ticket,memberId){
    const wantedScheme=String(schemeId ?? "");
    const wantedTicket=String(ticket ?? "").trim();
    const wantedMember=memberId == null ? null : String(memberId);
    return read(KEYS.winners,[]).find(w =>
      String(w?.schemeId ?? "") === wantedScheme &&
      getTicket(w) === wantedTicket &&
      (wantedMember == null || String(w?.memberId ?? "") === wantedMember) &&
      String(w?.status || "winner").toLowerCase() === "winner"
    ) || null;
  }
  function paymentAmount(scheme,month,member,ticket){
    if(!scheme)return 0;
    const m=Number(month);
    if(!Number.isInteger(m)||m<1)return 0;

    // Gold chits keep their configured month-wise rupee installment.
    if(normalizeChitType(scheme.type)==="gold"){
      const monthly=scheme.goldMonthlyInstallments||{};
      return Number(monthly[String(m)]??monthly[m]??scheme.baseAmount??0)||0;
    }

    const total=Number(scheme.totalAmount||0);
    if(total<=0)return Number(scheme.baseAmount||0)||0;

    // Cash chit rule: normal installment = 5% of chit value.
    // Once this exact member + scheme + ticket is declared a winner,
    // the installment becomes 6% starting in the winner's month.
    // Examples: 1 lakh -> 6000; 2 lakh -> 12000.
    const normalPayment=Math.round(total*0.05);
    const winnerPayment=Math.round(total*0.06);
    const winner=winnerForTicket(scheme.id,ticket,member?.id);
    const winningMonth=Number(winner?.month||0);
    return winningMonth>0 && m>=winningMonth ? winnerPayment : normalPayment;
  }
  function refreshPendingPaymentAmountsForWinner(scheme, winner){
    if(!scheme || !winner) return 0;
    if(normalizeChitType(scheme.type)==="gold") return 0;

    const winningMonth=Number(winner.month||0);
    const ticket=getTicket(winner);
    if(!Number.isInteger(winningMonth) || winningMonth<1 || !ticket) return 0;

    const total=Number(scheme.totalAmount||0);
    if(total<=0) return 0;

    const payments=read(KEYS.payments,[]);
    if(!Array.isArray(payments)) return 0;

    const normal=Math.round(total*0.05);
    const winnerAmount=Math.round(total*0.06);
    let changed=0;

    payments.forEach(function(payment){
      if(!payment) return;
      if(String(payment.status||"pending").toLowerCase()==="paid") return;
      const sameScheme=(String(payment.schemeId??"")===String(scheme.id??"")) ||
        String(payment.scheme||"").trim().toLowerCase()===String(scheme.name||"").trim().toLowerCase();
      const sameTicket=String(payment.ticket??payment.ticketNumber??"").trim()===String(ticket).trim();
      const month=Number(payment.month||0);
      if(!sameScheme || !sameTicket || !Number.isInteger(month) || month<1) return;
      const nextAmount=month>=winningMonth ? winnerAmount : normal;
      if(Number(payment.amount||0)!==nextAmount){
        payment.amount=nextAmount;
        payment.updatedAt=new Date().toISOString();
        changed++;
      }
    });

    if(changed) write(KEYS.payments,payments);
    return changed;
  }

  function goldGrams(scheme,winner){
    const direct=Number(winner?.goldGrams||scheme?.goldGrams||0);
    if(direct>0)return direct;
    const match=String(scheme?.name||"").match(/(\d+(?:\.\d+)?)\s*(?:grams?|g)\b/i);
    return match?Number(match[1]):0;
  }
  function winnerPayout(scheme,month,winner){
    if(!scheme)return 0;
    if(normalizeChitType(scheme.type)==="gold")return goldGrams(scheme,winner);
    const stored=Number(winner?.payout||0);
    if(stored>0)return stored;
    const total=Number(scheme.totalAmount||0);const m=Number(month);
    if(total<=0||!Number.isInteger(m)||m<1)return 0;
    return Math.round(total*(0.95+((m-1)*0.01)));
  }
  migrate();
  Object.assign(window,{FINTRACK_KEYS:KEYS,fintrackRead:read,fintrackWrite:write,normalizeChitType,generateFintrackId,generateFintrackUniqueId:uniqueId,getFintrackDueDate:dueDate,getFintrackCurrentDueMonth:currentDueMonth,fintrackDateReached:dateReached,fintrackPaymentAmount:paymentAmount,fintrackWinnerPayout:winnerPayout,refreshPendingPaymentAmountsForWinner:refreshPendingPaymentAmountsForWinner,fintrackGoldGrams:goldGrams,fintrackPaymentKey:businessKey,fintrackGetMember:getMemberById,fintrackGetScheme:getSchemeById,fintrackGetTicket:getTicket,fintrackGetMemberTicketEntry:getMemberTicketEntry,fintrackGetWinnerForTicket:winnerForTicket,fintrackIsSchemeFinalized:isSchemeFinalized,fintrackAudit:audit,fintrackNotify:notify,downloadFintrackBackup:backup,restoreFintrackBackup:restore,exportFintrackCSV:exportCSV});
})();

