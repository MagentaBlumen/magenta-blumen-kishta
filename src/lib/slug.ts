/**
 * Slugify German text for URL-safe slugs.
 *
 * Swiss orthography (per CLAUDE.md "Language" section):
 *   ä -> ae, ö -> oe, ü -> ue, ß -> ss (Swiss doesn't use ß but keep the
 *   mapping for pasted content from Germany).
 *
 * Not Unicode-aware beyond common German letters. Fine for this shop's
 * catalogue - all names are German product names. If a name comes in with
 * something we don't handle (accented french, katakana, emoji), the
 * non-alphanumeric strip below drops it.
 *
 * Enforces max 60 chars to stay well within Postgres index / URL sanity
 * limits. Product slugs are also `unique` in the schema, so callers must
 * handle collisions - the storefront urls need to stay stable per product,
 * and a silent append-`-2` behind the user's back would break links.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/&/g, "-und-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
