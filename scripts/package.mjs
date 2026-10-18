// Builds the portable Medley folder (dist/Medley) with Medley.exe.
//
//   npm run package                 build the app, then assemble the folder
//   npm run package -- --skip-build reuse the last `next build`
//
// The exe is a Node.js single executable application: a copy of node.exe with
// launcher/main.cjs injected. See launcher/main.cjs for what it does at runtime.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const out = path.join(dist, "Medley");
const appOut = path.join(out, "app");
const standalone = path.join(root, ".next", "standalone");

/** Runs a Node script with this same node.exe (no shell, so paths with spaces are fine). */
function node(...args) {
  console.log(`> node ${args.map((a) => path.relative(root, a) || a).join(" ")}`);
  execFileSync(process.execPath, args, { cwd: root, stdio: "inherit" });
}

const bin = (file) => path.join(root, "node_modules", file);

function copy(from, to) {
  fs.cpSync(from, to, { recursive: true });
}

if (!process.argv.includes("--skip-build")) node(bin("next/dist/bin/next"), "build");
if (!fs.existsSync(path.join(standalone, "server.js"))) {
  throw new Error("No standalone build found. Is output: \"standalone\" set in next.config.ts?");
}

// Keep the user's data and settings if they packaged into an existing folder.
fs.rmSync(path.join(out, "app"), { recursive: true, force: true });
fs.rmSync(path.join(out, "Medley.exe"), { force: true });
fs.mkdirSync(out, { recursive: true });

console.log("Copying the app…");
copy(standalone, appOut);
// The standalone build leaves out static assets; the server expects them here.
copy(path.join(root, ".next", "static"), path.join(appOut, ".next", "static"));
if (fs.existsSync(path.join(root, "public"))) copy(path.join(root, "public"), path.join(appOut, "public"));
copy(path.join(root, "prisma", "migrations"), path.join(appOut, "migrations"));

// Never ship your own keys or database: Next copies .env into the build.
for (const name of fs.readdirSync(appOut)) {
  if (name.startsWith(".env") || name.endsWith(".db")) {
    fs.rmSync(path.join(appOut, name), { force: true });
    console.log(`Removed ${name} from the package`);
  }
}

console.log("Building Medley.exe…");
const seaConfig = path.join(dist, "sea-config.json");
const blob = path.join(dist, "sea-prep.blob");
fs.writeFileSync(
  seaConfig,
  JSON.stringify({
    main: path.join(root, "launcher", "main.cjs"),
    output: blob,
    disableExperimentalSEAWarning: true,
  }),
);
node("--experimental-sea-config", seaConfig);

const exe = path.join(out, "Medley.exe");
fs.copyFileSync(process.execPath, exe);
node(
  bin("postject/dist/cli.js"),
  exe,
  "NODE_SEA_BLOB",
  blob,
  "--sentinel-fuse",
  "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
);
fs.rmSync(seaConfig);
fs.rmSync(blob);

fs.writeFileSync(
  path.join(out, "README.txt"),
  `Medley
======

Double-click Medley.exe to start. Your browser opens to http://localhost:3000.
Close the Medley window to stop it.

Everything stays in this folder:
  data\\medley.db   your list (back this up!)
  config.env       API keys, port and network settings (created on first run)

To update Medley, replace Medley.exe and the app folder. Keep data and config.env.
`,
);

console.log(`\nDone: ${out}`);
