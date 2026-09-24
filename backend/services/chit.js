function isGold(s){ return String(s?.chitType ?? s?.type ?? "").toLowerCase()==="gold"; }

function installment(s, month, winningMonth){
  const m=Number(month);
  if(!Number.isInteger(m)||m<1) return 0;
  if(isGold(s)){
    const map=s.goldMonthlyInstallments || {};
    return Number(map[String(m)] ?? map[m] ?? s.baseAmount ?? 0) || 0;
  }
  const total=Number(s.totalAmount||0);
  if(total<=0) return Number(s.baseAmount||0)||0;
  return Math.round(total * (Number(winningMonth)>0 && m>=Number(winningMonth) ? 0.06 : 0.05));
}

function payout(s,month){
  if(isGold(s)) return {cash:0,goldGrams:Number(s.goldGrams||0)};
  const total=Number(s.totalAmount||0), m=Number(month||1);
  return {cash:total>0?Math.round(total*(0.95+(Math.max(0,m-1)*0.01))):0,goldGrams:0};
}

function dueDate(s,month){
  if(!s?.startDate) return null;
  const d=new Date(s.startDate); if(Number.isNaN(d.getTime())) return null;
  const m=Number(month); if(!Number.isInteger(m)||m<1) return null;
  const startDay=d.getUTCDate();
  const base=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+m-1,1));
  if(startDay===25) return new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+1,5));
  const map={1:10,5:15,10:20,15:25};
  const day=map[startDay]||Math.min(startDay+10,new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+1,0)).getUTCDate());
  return new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),day));
}
function paymentKey(member,scheme,ticket,month){ return `${member}|${scheme}|${String(ticket).trim()}|${Number(month)}`; }
module.exports={isGold,installment,payout,dueDate,paymentKey};
