import { DateTime } from "luxon";
import { fetchSystemHealth } from "../src/lib/admin/system-health";

/**
 * Delivery-horizon sanity check. Reports the furthest bookable delivery
 * date and whether it is at least 30 days out. If it is not, exits with
 * code 1 so a cron caller can escalate. Designed to catch a silent
 * failure of the nightly `generate-runs` job — the first visible
 * customer symptom otherwise is "no dates" three weeks from now, long
 * after the cause.
 *
 * Usage: `npx tsx scripts/check-delivery-horizon.ts`
 *
 * Deliberately NOT wired into systemd here (per launch-tasks.md Task 16
 * — that is server-side and out of this repo's scope). Call the admin
 * Einstellungen page for the same number inside the UI.
 */

const TARGET_DAYS = 30;

async function main(): Promise<void> {
  const health = await fetchSystemHealth();
  const latestRunDate = health.runs.latestRunDate;
  const daysAhead = health.runs.daysAhead;

  const latestLabel = latestRunDate
    ? DateTime.fromISO(latestRunDate, { zone: "Europe/Zurich" })
        .setLocale("de-CH")
        .toFormat("d. LLLL yyyy")
    : "keine Touren erfasst";

  console.log(`Letzter bekannter Liefertermin : ${latestLabel}`);
  console.log(`Vorlauf                        : ${daysAhead} Tage`);
  console.log(`Ziel                           : ≥ ${TARGET_DAYS} Tage`);

  if (daysAhead < TARGET_DAYS) {
    console.error(
      `\nFEHLER: Lieferhorizont unter ${TARGET_DAYS} Tagen. Nightly generate-runs prüfen.`,
    );
    process.exit(1);
  }
  console.log(`\nOK — Lieferhorizont reicht.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
