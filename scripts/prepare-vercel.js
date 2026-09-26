const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const frontend = path.join(root, "frontend");
const publicDir = path.join(root, "public");

fs.rmSync(publicDir, { recursive: true, force: true });
fs.cpSync(frontend, publicDir, { recursive: true });
console.log("Prepared Vercel static assets in public/.");
