const Scheme=require("../models/Scheme");

function startOfNextIndiaDay(now=new Date()){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const value=Object.fromEntries(parts.filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
  const next=new Date(`${value.year}-${value.month}-${value.day}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate()+1);
  return next;
}

function schemeHasStarted(startDate,now=new Date()){
  return new Date(startDate)<startOfNextIndiaDay(now);
}

async function activateStartedSchemes(filter){
  await Scheme.updateMany({...filter,status:"upcoming",startDate:{$lt:startOfNextIndiaDay()}},{$set:{status:"active"}});
}

module.exports={activateStartedSchemes,schemeHasStarted};
