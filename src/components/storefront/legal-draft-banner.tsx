/**
 * Draft banner shown at the top of every legal page until a lawyer
 * has signed off. Visible to the end user so if we accidentally ship
 * before review, it's obvious something's unfinished.
 *
 * Remove by deleting the component usages (not by setting a flag).
 * Deleting the import makes the "we shipped drafts" state impossible
 * to miss on review.
 */
export function LegalDraftBanner() {
  return (
    <div className="bg-rose/10 border border-rose/40 text-bark px-4 py-3 text-[0.78rem] leading-[1.6] rounded-sm">
      <strong className="font-medium">Entwurf.</strong> Dieser Text wurde
      aus den Betriebsangaben zusammengestellt und muss vor Launch
      juristisch geprüft werden.
    </div>
  );
}
