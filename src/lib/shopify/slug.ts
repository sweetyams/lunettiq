/**
 * Derive a clean URL slug from a Shopify handle.
 *   "hatley-©-green"           → "hatley-green"
 *   "shelby-opt-black"         → "shelby-black"
 *   "bowie-sun-grey"           → "bowie-sun-grey"   (keep -sun- to avoid collision with optical)
 *   "bond-©-silver-optic"      → "bond-silver"
 *   "bond-©-silver-sunglasses" → "bond-silver-sun"
 *   "drewe-©-tortoise-optics"  → "drewe-tortoise"
 */
export function toSlug(handle: string): string {
  return handle
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')       // strip non-ASCII (©, ™)
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-opt-/g, '-')              // shelby-opt-black → shelby-black
    .replace(/-optics?$/g, '')           // drewe-tortoise-optics → drewe-tortoise
    .replace(/-sunglasses$/g, '-sun')    // bond-silver-sunglasses → bond-silver-sun
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
