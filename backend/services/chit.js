function isGold(s){ return String(s?.chitType ?? s?.type ?? "").toLowerCase()==="gold"; }

function installment(s, month, winningMonth){
  const m=Number(month);
  if(!Number.isInteger(m)||m<1) return 0;
  if(isGold(s)){
    const map=s.goldMonthlyInstallments || {};
    const configured=map instanceof Map ? map.get(String(m)) : (map[String(m)] ?? map[m]);
    const hasSchedule=map instanceof Map ? map.size>0 : Object.keys(map).length>0;
    return Number(configured ?? (hasSchedule ? 0 : s.baseAmount) ?? 0) || 0;
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
  const monthDays=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+1,0)).getUTCDate();
  const anniversaryDay=Math.min(startDay,monthDays);
  const day=(startDay===1?10:anniversaryDay+10);
  return new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),day));
}
function overdueDate(s,month){
  return dueDate(s,month);
}
function dateKey(date,timeZone="Asia/Kolkata"){
  if(!date)return "";
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function pastGracePeriod(s,month,now=new Date()){
  const cutoff=overdueDate(s,month);
  return Boolean(cutoff&&dateKey(now)>dateKey(cutoff,"UTC"));
}
function paymentKey(member,scheme,ticket,month){ return `${member}|${scheme}|${String(ticket).trim()}|${Number(month)}`; }
module.exports={isGold,installment,payout,dueDate,overdueDate,pastGracePeriod,paymentKey};
