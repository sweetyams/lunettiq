import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { loyaltyTiers } from '../src/lib/db/schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const TIERS = [
  {
    id: 'essential', label: 'Essential', tag: 'member-essential',
    monthlyCredit: '12', birthdayCredit: '25', tradeInRate: '0.150',
    lensRefresh: false, frameRotation: null, sortOrder: 0,
    monthlyFee: '19', annualFee: '199', secondSightRate: '0.150',
    earlyAccessHours: 24, namedOptician: false, freeRepairs: '1/yr',
    styleConsultation: null, eventsPerYear: 0, annualGift: false,
    archiveVote: false, privateWhatsapp: false,
  },
  {
    id: 'cult', label: 'CULT', tag: 'member-cult',
    monthlyCredit: '25', birthdayCredit: '25', tradeInRate: '0.300',
    lensRefresh: true, frameRotation: '25% off', sortOrder: 1,
    monthlyFee: '39', annualFee: '399', secondSightRate: '0.300',
    earlyAccessHours: 48, namedOptician: true, freeRepairs: 'unlimited',
    styleConsultation: '30 min/yr', eventsPerYear: 0, annualGift: false,
    archiveVote: false, privateWhatsapp: false,
  },
  {
    id: 'vault', label: 'VAULT', tag: 'member-vault',
    monthlyCredit: '45', birthdayCredit: '50', tradeInRate: '0.350',
    lensRefresh: true, frameRotation: 'Free swap', sortOrder: 2,
    monthlyFee: '79', annualFee: '799', secondSightRate: '0.350',
    earlyAccessHours: 96, namedOptician: true, freeRepairs: 'unlimited',
    styleConsultation: 'unlimited', eventsPerYear: 4, annualGift: true,
    archiveVote: true, privateWhatsapp: true,
  },
];

async function main() {
  console.log('Seeding V2 loyalty tiers…');
  for (const t of TIERS) {
    await db.insert(loyaltyTiers).values(t).onConflictDoUpdate({
      target: loyaltyTiers.id,
      set: { ...t },
    });
  }
  console.log(`Done — ${TIERS.length} tiers seeded with V2 pricing.`);
}

main().catch(console.error);
