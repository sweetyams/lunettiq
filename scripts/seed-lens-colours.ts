/**
 * Seed lens colour sets and options.
 * Run: npx tsx scripts/seed-lens-colours.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { lensColourSets, lensColourOptions } from '../src/lib/db/schema';

const pg = neon(process.env.DATABASE_URL!);
const db = drizzle(pg);

interface C { code: string; label: string; short: string; desc: string; hex: string; hexEnd?: string; price: string; cat: string }

const sets: { code: string; label: string; colours: C[] }[] = [
  { code: 'standard', label: 'Standard', colours: [
    { code: 'std_black', label: 'Black', short: 'Solid black tint', desc: 'Standard solid black lens tint.', hex: '#393833', price: '0', cat: 'standard' },
    { code: 'std_brown', label: 'Brown', short: 'Solid brown tint', desc: 'Standard solid brown lens tint.', hex: '#8B634E', price: '0', cat: 'standard' },
  ]},
  { code: 'custom_solid', label: 'Custom Solid', colours: [
    { code: 'cus_burgundy', label: 'Burgundy', short: 'Solid burgundy tint', desc: 'Custom solid burgundy lens tint.', hex: '#6E2233', price: '25', cat: 'custom_solid' },
    { code: 'cus_blue', label: 'Blue', short: 'Solid blue tint', desc: 'Custom solid blue lens tint.', hex: '#3A66A7', price: '25', cat: 'custom_solid' },
    { code: 'cus_champagne', label: 'Champagne', short: 'Solid champagne tint', desc: 'Custom solid champagne lens tint.', hex: '#D8C39A', price: '25', cat: 'custom_solid' },
    { code: 'cus_green', label: 'Green', short: 'Solid green tint', desc: 'Custom solid green lens tint.', hex: '#49594F', price: '25', cat: 'custom_solid' },
    { code: 'cus_mint', label: 'Mint', short: 'Solid mint tint', desc: 'Custom solid mint lens tint.', hex: '#949D87', price: '25', cat: 'custom_solid' },
    { code: 'cus_dark_blue', label: 'Dark Blue', short: 'Solid dark blue tint', desc: 'Custom solid dark blue lens tint.', hex: '#2C4355', price: '25', cat: 'custom_solid' },
  ]},
  { code: 'custom_fade', label: 'Custom Fade', colours: [
    { code: 'fad_black', label: 'Black Fade', short: 'Black fade tint', desc: 'Custom fade tint with a black gradient.', hex: '#272323', hexEnd: '#8B7C7C', price: '25', cat: 'custom_fade' },
    { code: 'fad_brown', label: 'Brown Fade', short: 'Brown fade tint', desc: 'Custom fade tint with a brown gradient.', hex: '#092715', hexEnd: '#86948B', price: '25', cat: 'custom_fade' },
    { code: 'fad_green', label: 'Green Fade', short: 'Green fade tint', desc: 'Custom fade tint with a green gradient.', hex: '#092715', hexEnd: '#86948B', price: '25', cat: 'custom_fade' },
    { code: 'fad_blue', label: 'Blue Fade', short: 'Blue fade tint', desc: 'Custom fade tint with a blue gradient.', hex: '#091D27', hexEnd: '#868E94', price: '25', cat: 'custom_fade' },
    { code: 'fad_red', label: 'Red Fade', short: 'Red fade tint', desc: 'Custom fade tint with a red gradient.', hex: '#A14A57', hexEnd: '#D4B5B8', price: '25', cat: 'custom_fade' },
    { code: 'fad_burgundy', label: 'Burgundy Fade', short: 'Burgundy fade tint', desc: 'Custom fade tint with a burgundy gradient.', hex: '#3B040A', hexEnd: '#B19EA0', price: '25', cat: 'custom_fade' },
  ]},
  { code: 'polarized', label: 'Polarized', colours: [
    { code: 'pol_black', label: 'Black', short: 'Polarized black tint', desc: 'Polarized black lens tint.', hex: '#363530', price: '70', cat: 'polarized' },
    { code: 'pol_brown', label: 'Brown', short: 'Polarized brown tint', desc: 'Polarized brown lens tint.', hex: '#4E3E2F', price: '70', cat: 'polarized' },
    { code: 'pol_khaki', label: 'Khaki', short: 'Polarized khaki tint', desc: 'Polarized khaki lens tint.', hex: '#49594F', price: '70', cat: 'polarized' },
  ]},
];

async function seed() {
  console.log('Clearing existing lens colour data...');
  await db.delete(lensColourOptions);
  await db.delete(lensColourSets);

  console.log('Seeding lens colours...');
  for (let si = 0; si < sets.length; si++) {
    const s = sets[si];
    const [set] = await db.insert(lensColourSets).values({ code: s.code, label: s.label, sortOrder: si * 10 }).returning();
    for (let ci = 0; ci < s.colours.length; ci++) {
      const c = s.colours[ci];
      await db.insert(lensColourOptions).values({
        setId: set.id, code: c.code, label: c.label,
        shortDescription: c.short, description: c.desc,
        hex: c.hex, hexEnd: c.hexEnd ?? null, price: c.price, category: c.cat, sortOrder: ci * 10,
      });
    }
    console.log(`  ${s.label}: ${s.colours.length} colours`);
  }

  console.log('Done.');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
