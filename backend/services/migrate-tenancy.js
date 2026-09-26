const User = require("../models/User");
const Member = require("../models/Member");
const Scheme = require("../models/Scheme");
const Notification = require("../models/Notification");
const { BankAccount, PaymentSettings } = require("../models/PaymentSettings");

async function migrateTenancy() {
  const duplicatePhones = await Member.collection.aggregate([
    { $group: { _id: "$phone", ids: { $push: "$_id" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 10 }
  ]).toArray();
  if (duplicatePhones.length) {
    const rows = duplicatePhones.map(row => `${row._id}: ${row.ids.join(", ")}`).join("; ");
    throw new Error(`Cannot enforce globally unique member phone numbers. Resolve existing duplicates first: ${rows}`);
  }
  await Promise.all([
    Member.collection.createIndex({ email: 1 }, { unique: true }),
    Member.collection.createIndex({ phone: 1 }, { unique: true })
  ]);

  // Records created before tenant ownership existed are assigned to the oldest
  // manager so the existing workspace remains intact as one private tenant.
  const primaryManager = await User.findOne({ role: { $in: ["manager", "admin"] } })
    .sort({ accountCreated: 1, _id: 1 })
    .select("_id");

  if (!primaryManager) {
    console.warn("Tenancy migration skipped: create a manager account before assigning legacy data.");
    return;
  }

  await User.updateMany({ role: "admin" }, { $set: { role: "manager" } });
  const owner = primaryManager._id;
  await Promise.all([
    Member.updateMany({ manager: { $exists: false } }, { $set: { manager: owner } }),
    Scheme.updateMany({ manager: { $exists: false } }, { $set: { manager: owner } }),
    BankAccount.updateMany({ manager: { $exists: false } }, { $set: { manager: owner } }),
    PaymentSettings.updateMany({ manager: { $exists: false } }, { $set: { manager: owner } }),
    Notification.updateMany({ manager: { $exists: false }, member: null }, { $set: { manager: owner } })
  ]);

  await Member.collection.createIndex({ manager: 1 });

  // Older releases enforced scheme names globally. Tenant ownership changes
  // that rule to one unique name per manager.
  try { await Scheme.collection.dropIndex("name_1"); }
  catch (error) { if (![26, 27].includes(error.code) && !["NamespaceNotFound", "IndexNotFound"].includes(error.codeName)) throw error; }
}

module.exports = migrateTenancy;
