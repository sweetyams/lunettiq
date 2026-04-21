/**
 * Regenerate all product slugs from family data.
 * Family products: family-name + colour + type → "shelby-black", "shelby-black-sun"
 * Non-family products: toSlug(handle) fallback
 *
 * Usage: npx tsx scripts/backfill-slugs.ts
 */
import 'dotenv/config';
import '../src/lib/db'; // ensure env loaded
import { regenerateAllSlugs } from '../src/lib/crm/regenerate-slugs';

async function main() {
  console.log('Regenerating all slugs...');
  await regenerateAllSlugs();
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
