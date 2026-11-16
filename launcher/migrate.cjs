// Applies prisma/migrations that a database hasn't seen yet. Shared by the
// Windows launcher (main.cjs) and the Docker entrypoint (docker/start.cjs);
// both ship it inside the app folder as migrate.cjs.
//
// Records migrations in Prisma's own _prisma_migrations table, so the
// database stays compatible with `prisma migrate` during development.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

/**
 * @param {object} o
 * @param {string} o.dbPath         SQLite file (created if missing)
 * @param {string} o.migrationsDir  folder of <name>/migration.sql
 * @param {Function} o.Database     better-sqlite3's constructor
 */
function migrate({ dbPath, migrationsDir, Database }) {
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

module.exports = { migrate };
