const { URL } = require("node:url");

if (!process.env.MONGO_URI) {
  const host = process.env.MONGO_HOST || "mongo";
  const database = process.env.MONGO_DATABASE || "fintrack";
  const username = process.env.MONGO_APP_USERNAME;
  const password = process.env.MONGO_APP_PASSWORD;
  if (!username || !password) {
    throw new Error("MONGO_APP_USERNAME and MONGO_APP_PASSWORD are required.");
  }

  const uri = new URL(`mongodb://${host}/${database}`);
  uri.username = username;
  uri.password = password;
  uri.searchParams.set("authSource", database);
  process.env.MONGO_URI = uri.toString();
}

require("./server");
