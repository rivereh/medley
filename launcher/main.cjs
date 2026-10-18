// Medley launcher: the entry point baked into Medley.exe (a Node.js single
// executable application). It keeps everything next to the exe:
//
//   Medley/
//   ├─ Medley.exe     this launcher
//   ├─ app/           the standalone Next.js server
//   ├─ data/          medley.db lives here
//   └─ config.env     API keys, port, host
//
// On start it loads config.env, creates/updates the database, starts the
// server in this process and opens the browser. Closing the window stops it.
//
// For testing without building the exe:  node launcher/main.cjs dist/Medley
// Set MEDLEY_NO_BROWSER=1 to skip opening the browser.

const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const http = require("node:http");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { createRequire } = require("node:module");

const isSea = (() => {
  try {
    return require("node:sea").isSea();
  } catch {
    return false;
  }
})();

const root = isSea
  ? path.dirname(process.execPath)
  : path.resolve(process.argv[2] ?? path.join(__dirname, "..", "dist", "Medley"));
const appDir = path.join(root, "app");
const dataDir = path.join(root, "data");
const configPath = path.join(root, "config.env");
const dbPath = path.join(dataDir, "medley.db");

// Code inside the exe can only require Node built-ins; load app modules from disk.
const appRequire = createRequire(path.join(appDir, "server.js"));

const CONFIG_TEMPLATE = `# Medley settings. Restart Medley after changing anything here.

# Movies & TV search: free "API Read Access Token" from
# https://www.themoviedb.org/settings/api
TMDB_READ_TOKEN=

# Games search: create a free app at https://dev.twitch.tv/console/apps
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=

# Port for the web interface.
PORT=3000

# 127.0.0.1 = only this PC can open Medley.
# 0.0.0.0   = other devices on your network can too (e.g. your phone).
HOST=127.0.0.1
`;

function waitAndExit(code) {
  console.log("\nPress Enter to close this window.");
  process.stdin.resume();
  process.stdin.once("data", () => process.exit(code));
}

function fail(message) {
  console.error(`\n${message}`);
  waitAndExit(1);
}

/** Reads KEY=VALUE lines; creates the file from the template the first time. */
function loadConfig() {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, CONFIG_TEMPLATE);
    console.log(`Created ${configPath}. Add your API keys there to enable search.`);
  }
  const config = {};
  for (const line of fs.readFileSync(configPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) config[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return config;
}

/**
 * Applies prisma/migrations (bundled as app/migrations) that the database
 * hasn't seen yet. Records them in Prisma's own _prisma_migrations table, so
 * the database stays compatible with `prisma migrate` during development.
 */
function migrate() {
  const Database = appRequire("better-sqlite3");
  const db = new Database(dbPath);
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
    )`);
    const applied = new Set(
      db
        .prepare(`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL`)
        .all()
        .map((r) => r.migration_name),
    );

    const migrationsDir = path.join(appDir, "migrations");
    const pending = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !applied.has(d.name))
      .map((d) => d.name)
      .sort();

    for (const name of pending) {
      const sql = fs.readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
      console.log(`Updating database: ${name}`);
      // Not wrapped in a transaction: migrations toggle PRAGMA foreign_keys,
      // which SQLite ignores inside one (Prisma runs them the same way).
      db.exec(sql);
      db.prepare(
        `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count)
         VALUES (?, ?, current_timestamp, ?, 1)`,
      ).run(crypto.randomUUID(), crypto.createHash("sha256").update(sql).digest("hex"), name);
    }
  } finally {
    db.close();
  }
}

function portInUse(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => server.close(() => resolve(false)));
    server.listen(port, host);
  });
}

function waitForServer(url, timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve) => {
    const attempt = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve(true);
        })
        .on("error", () => {
          if (Date.now() - started > timeoutMs) resolve(false);
          else setTimeout(attempt, 300);
        });
    };
    attempt();
  });
}

function openBrowser(url) {
  if (process.env.MEDLEY_NO_BROWSER) return;
  const [cmd, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : [process.platform === "darwin" ? "open" : "xdg-open", [url]];
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
}

async function main() {
  process.title = "Medley";
  if (!fs.existsSync(path.join(appDir, "server.js"))) {
    return fail(`Couldn't find ${path.join(appDir, "server.js")}. Keep Medley.exe next to its app folder.`);
  }

  const config = loadConfig();
  for (const key of ["TMDB_READ_TOKEN", "TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"]) {
    if (config[key]) process.env[key] = config[key];
  }
  const port = Number(config.PORT) || 3000;
  const host = config.HOST || "127.0.0.1";
  const url = `http://localhost:${port}`;

  fs.mkdirSync(dataDir, { recursive: true });
  process.env.DATABASE_URL = `file:${dbPath}`;
  try {
    migrate();
  } catch (err) {
    return fail(`Couldn't set up the database at ${dbPath}:\n${err.stack ?? err}`);
  }

  if (await portInUse(port, host)) {
    openBrowser(url);
    return fail(
      `Port ${port} is already in use.\n` +
        `If Medley is already running, it has been opened in your browser.\n` +
        `Otherwise, change PORT in ${configPath}.`,
    );
  }

  process.env.NODE_ENV = "production";
  process.env.PORT = String(port);
  process.env.HOSTNAME = host;

  console.log(`Starting Medley…`);
  appRequire(path.join(appDir, "server.js"));

  if (await waitForServer(url)) {
    console.log(`\nMedley is running at ${url}`);
    if (host === "0.0.0.0") console.log("Other devices on your network can use this PC's IP address.");
    console.log(`Data folder: ${dataDir}`);
    console.log("Close this window to stop Medley.\n");
    openBrowser(url);
  } else {
    console.error(`Medley didn't start responding at ${url}. Check the messages above.`);
  }
}

main().catch((err) => fail(err.stack ?? String(err)));
