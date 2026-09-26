const Scheme=require("../models/Scheme");
const Ticket=require("../models/MemberSchemeTicket");
const Payment=require("../models/Payment");
const OnlinePaymentRequest=require("../models/OnlinePaymentRequest");
const Notification=require("../models/Notification");
const {installment,dueDate,overdueDate,pastGracePeriod,paymentKey}=require("./chit");

async function notifyOverdueMembers(now=new Date()){
  const schemes=await Scheme.find({}).select("manager name chitType totalAmount baseAmount goldMonthlyInstallments duration startDate");
  for(const scheme of schemes){
    const tickets=await Ticket.find({scheme:scheme._id}).select("member ticketNumber winningMonth").lean();
    if(!tickets.length)continue;
    const [paidRows,requests,notices]=await Promise.all([
      Payment.find({scheme:scheme._id,status:"paid"}).select("member ticketNumber month").lean(),
      OnlinePaymentRequest.find({scheme:scheme._id,status:{$in:["pending","approved"]}}).select("member ticketNumber month").lean(),
      Notification.find({manager:scheme.manager,type:"payment_due","extra.schemeId":String(scheme._id)}).select("extra.paymentKey").lean()
    ]);
    const paid=new Set(paidRows.map(row=>paymentKey(row.member,scheme._id,row.ticketNumber,row.month)));
    const waiting=new Set(requests.map(row=>paymentKey(row.member,scheme._id,row.ticketNumber,row.month)));
    const alreadyNotified=new Set(notices.map(row=>row.extra?.paymentKey).filter(Boolean));
    const notifications=[];
    for(const ticket of tickets){
      for(let month=1;month<=Number(scheme.duration||0);month+=1){
        const key=paymentKey(ticket.member,scheme._id,ticket.ticketNumber,month);
        const amount=installment(scheme,month,ticket.winningMonth);
        if(!(amount>0)||!pastGracePeriod(scheme,month,now)||paid.has(key)||waiting.has(key)||alreadyNotified.has(key))continue;
        const due=dueDate(scheme,month);
        const lateDate=overdueDate(scheme,month);
        notifications.push({
          manager:scheme.manager,
          member:ticket.member,
          type:"payment_due",
          message:`Payment of ₹${amount.toLocaleString("en-IN")} for ${scheme.name}, Ticket #${ticket.ticketNumber}, Month ${month} is overdue. Please pay your manager.`,
          extra:{paymentKey:key,schemeId:String(scheme._id),ticketNumber:ticket.ticketNumber,month,amount,dueDate:due?.toISOString()||null,graceEnded:lateDate?.toISOString()||null}
        });
        alreadyNotified.add(key);
      }
    }
    if(notifications.length)await Notification.insertMany(notifications,{ordered:false});
  }
}

module.exports={notifyOverdueMembers};
