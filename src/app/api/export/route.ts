import { buildBackup } from "@/lib/backup";
import { toLocalDayInput } from "@/lib/dates";
import { getCurrentUser } from "@/lib/user";

/** Downloads everything on the user's list as a JSON file. */
export async function GET() {
  const user = await getCurrentUser();
  const backup = await buildBackup(user.id);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="medley-export-${toLocalDayInput(new Date())}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
