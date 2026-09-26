const Scheme = require("../models/Scheme");

const isManager = user => ["manager", "admin"].includes(user?.role);

async function managerSchemeIds(user) {
  if (!isManager(user)) return [];
  return Scheme.distinct("_id", { manager: user._id });
}

module.exports = { isManager, managerSchemeIds };
