// Docker entrypoint: brings the database up to date, then starts the
// standalone Next.js server. Lives in the image's /app next to server.js.
//
//   /app    the app (replaced on every update)
//   /data   medley.db, kept in a volume

const fs = require("node:fs");
const path = require("node:path");

const dataDir = process.env.MEDLEY_DATA_DIR || "/data";
const dbPath = path.join(dataDir, "medley.db");

fs.mkdirSync(dataDir, { recursive: true });
process.env.DATABASE_URL = `file:${dbPath}`;

require("./migrate.cjs").migrate({
  dbPath,
  migrationsDir: path.join(__dirname, "migrations"),
  Database: require("better-sqlite3"),
});

console.log(`Medley ${process.env.MEDLEY_VERSION ?? ""} starting on port ${process.env.PORT}`);
console.log(`Data: ${dataDir}`);
require("./server.js");
