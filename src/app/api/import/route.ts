import { revalidatePath } from "next/cache";
import { BackupError, importBackup } from "@/lib/backup";
import { getCurrentUser } from "@/lib/user";

/**
 * Imports a Medley export (the JSON file as the request body).
 * `?replace=1` clears the current list first; otherwise it merges.
 * A route handler rather than a server action, so big files aren't limited
 * by the server action body size cap.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  const replace = new URL(request.url).searchParams.get("replace") === "1";

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: "That file isn't valid JSON." }, { status: 400 });
  }

  try {
    const result = await importBackup(user.id, data, { replace });
    revalidatePath("/list");
    revalidatePath("/search");
    revalidatePath("/settings");
    return Response.json(result);
  } catch (err) {
    if (err instanceof BackupError) return Response.json({ error: err.message }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Import failed. Nothing was changed." }, { status: 500 });
  }
}
