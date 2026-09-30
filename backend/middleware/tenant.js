const Scheme = require("../models/Scheme");

const isManager = user => ["manager", "admin"].includes(user?.role);

function userMemberIds(user) {
  if (!user) return [];
  const ids = [...(user.memberIds || []), ...(user.memberId ? [user.memberId] : [])];
  return [...new Map(ids.filter(Boolean).map(id => [String(id), id])).values()];
}

async function managerSchemeIds(user) {
  if (!isManager(user)) return [];
  return Scheme.distinct("_id", { manager: user._id });
}

module.exports = { isManager, managerSchemeIds, userMemberIds };
