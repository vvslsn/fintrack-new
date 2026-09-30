const User = require("../models/User");
const Member = require("../models/Member");
const Scheme = require("../models/Scheme");
const Notification = require("../models/Notification");
const { BankAccount, PaymentSettings } = require("../models/PaymentSettings");

async function migrateTenancy() {
  // Existing schemes keep working with the historic 10th-of-month default.
  await Scheme.updateMany({ $or: [{ dueDate: { $exists: false } }, { dueDate: null }] }, { $set: { dueDate: 10 } });
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
  const legacyMemberUsers = await User.find({
    role: "user",
    memberId: { $ne: null },
    $or: [{ memberIds: { $exists: false } }, { memberIds: { $size: 0 } }]
  }).select("_id memberId").lean();
  if (legacyMemberUsers.length) {
    await User.bulkWrite(legacyMemberUsers.map(user => ({
      updateOne: { filter: { _id: user._id }, update: { $set: { memberIds: [user.memberId] } } }
    })));
  }
  const owner = primaryManager._id;
  await Promise.all([
    Member.updateMany({ manager: { $exists: false } }, { $set: { manager: owner } }),
    Scheme.updateMany({ manager: { $exists: false } }, { $set: { manager: owner } }),
    BankAccount.updateMany({ manager: { $exists: false } }, { $set: { manager: owner } }),
    PaymentSettings.updateMany({ manager: { $exists: false } }, { $set: { manager: owner } }),
    Notification.updateMany({ manager: { $exists: false }, member: null }, { $set: { manager: owner } })
  ]);

  const duplicateContacts = await Promise.all(["email", "phone"].map(field => Member.collection.aggregate([
    { $group: { _id: { manager: "$manager", value: `$${field}` }, ids: { $push: "$_id" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 10 }
  ]).toArray()));
  if (duplicateContacts.some(rows => rows.length)) {
    const rows = duplicateContacts.flat().map(row => `${JSON.stringify(row._id)}: ${row.ids.join(", ")}`).join("; ");
    throw new Error(`Cannot enforce manager-scoped member contact uniqueness. Resolve duplicate records within each manager first: ${rows}`);
  }
  for (const indexName of ["email_1", "phone_1"]) {
    try { await Member.collection.dropIndex(indexName); }
    catch (error) { if (![26, 27].includes(error.code) && !["NamespaceNotFound", "IndexNotFound"].includes(error.codeName)) throw error; }
  }
  await Promise.all([
    Member.collection.createIndex({ manager: 1, email: 1 }, { unique: true }),
    Member.collection.createIndex({ manager: 1, phone: 1 }, { unique: true })
  ]);

  await Member.collection.createIndex({ manager: 1 });

  // Older releases enforced scheme names globally. Tenant ownership changes
  // that rule to one unique name per manager.
  try { await Scheme.collection.dropIndex("name_1"); }
  catch (error) { if (![26, 27].includes(error.code) && !["NamespaceNotFound", "IndexNotFound"].includes(error.codeName)) throw error; }
}

module.exports = migrateTenancy;
