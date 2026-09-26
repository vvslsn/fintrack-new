const appUsername = process.env.MONGO_APP_USERNAME;
const appPassword = process.env.MONGO_APP_PASSWORD;

if (!appUsername || !appPassword) {
  throw new Error("MONGO_APP_USERNAME and MONGO_APP_PASSWORD must be set.");
}

const appDatabase = db.getSiblingDB("fintrack");
appDatabase.createUser({
  user: appUsername,
  pwd: appPassword,
  roles: [{ role: "readWrite", db: "fintrack" }]
});
