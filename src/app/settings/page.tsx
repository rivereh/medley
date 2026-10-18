import { Suspense } from "react";
import { RatingScaleSetting } from "@/components/rating-scale-setting";
import { getCurrentUser } from "@/lib/user";

export default function SettingsPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  const user = await getCurrentUser();
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-surface p-4">
      <div>
        <h2 className="font-semibold">Rating format</h2>
        <p className="text-sm text-muted">
          How ratings are shown and entered. Switching never changes your existing ratings.
        </p>
      </div>
      <RatingScaleSetting current={user.ratingScale} />
    </section>
  );
}
