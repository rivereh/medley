import { connection } from "next/server";
import { checkForUpdate } from "@/lib/updates";

/** Whether a newer release is on GitHub. Polled by the header's update notice. */
export async function GET() {
  await connection();
  return Response.json(await checkForUpdate(), { headers: { "Cache-Control": "no-store" } });
}
