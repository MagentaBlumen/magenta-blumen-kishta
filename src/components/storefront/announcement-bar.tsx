// Top-of-page strip. Copy from docs/storefront-copy-truth.md - two
// runs per day incl. Sunday is the differentiator worth calling out
// (unusual for a Swiss florist), so it goes here.

export function AnnouncementBar() {
  return (
    <div className="bg-bark text-cream text-center py-2.5 text-[0.68rem] tracking-[0.14em] uppercase font-body font-medium">
      Blumen aus Neuenhof · Zwei Touren täglich: 10:00 & 16:00
      <span className="hidden sm:inline"> · Auch am Sonntag</span>
    </div>
  );
}
