import { connection } from "next/server";
import { db } from "./db";

// No auth yet: everything belongs to a single local user.
// Swap this for the signed-in user once auth is added.
export async function getCurrentUser() {
  // User data is per-request, so never prerender anything that reads it.
  await connection();
  return db.user.upsert({
    where: { username: "me" },
    update: {},
    create: { username: "me" },
  });
}
