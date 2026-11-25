import { Suspense } from "react";
import { DataTransfer } from "@/components/data-transfer";
import { FeedTypesSetting } from "@/components/feed-types-setting";
import { RatingScaleSetting } from "@/components/rating-scale-setting";
import { TimeZoneCheck } from "@/components/time-zone-check";
import { UpdateStatus } from "@/components/update-notice";
import { parseTypes } from "@/lib/labels";
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
    <>
      <section className="flex flex-col gap-3 rounded-lg bg-surface p-4">
        <div>
          <h2 className="font-semibold">Rating format</h2>
          <p className="text-sm text-muted">
            How ratings are shown and entered. Switching never changes your existing ratings.
          </p>
        </div>
        <RatingScaleSetting current={user.ratingScale} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg bg-surface p-4">
        <div>
          <h2 className="font-semibold">What My list shows</h2>
          <p className="text-sm text-muted">
            Hide types you don’t want in the list or the grid. Picking a type in My list’s Type
            filter still shows it.
          </p>
        </div>
        <FeedTypesSetting
          hiddenList={parseTypes(user.hiddenListTypes)}
          hiddenGrid={parseTypes(user.hiddenGridTypes)}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-lg bg-surface p-4">
        <h2 className="font-semibold">Your data</h2>
        <DataTransfer />
      </section>

      <section className="flex flex-col gap-3 rounded-lg bg-surface p-4">
        <h2 className="font-semibold">Time zone</h2>
        <TimeZoneCheck serverZone={Intl.DateTimeFormat().resolvedOptions().timeZone} />
      </section>

      <section id="updates" className="flex flex-col gap-3 rounded-lg bg-surface p-4">
        <h2 className="font-semibold">Updates</h2>
        <UpdateStatus />
      </section>
    </>
  );
}
