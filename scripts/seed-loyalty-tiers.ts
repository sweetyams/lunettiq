import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { loyaltyTiers } from '../src/lib/db/schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const TIERS = [
  { id: 'essential', label: 'Essential', tag: 'member-essential', monthlyCredit: '15', birthdayCredit: '20', tradeInRate: '0.200', lensRefresh: false, frameRotation: null, sortOrder: 0 },
  { id: 'cult', label: 'CULT', tag: 'member-cult', monthlyCredit: '30', birthdayCredit: '20', tradeInRate: '0.300', lensRefresh: true, frameRotation: '25% off', sortOrder: 1 },
  { id: 'vault', label: 'VAULT', tag: 'member-vault', monthlyCredit: '60', birthdayCredit: '20', tradeInRate: '0.375', lensRefresh: true, frameRotation: 'Free swap', sortOrder: 2 },
];

async function main() {
  console.log('Seeding loyalty tiers…');
  for (const t of TIERS) {
    await db.insert(loyaltyTiers).values(t).onConflictDoNothing();
  }
  console.log(`Done — ${TIERS.length} tiers seeded.`);
}

main().catch(console.error);
