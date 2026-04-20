import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { appointmentTypes } from '../src/lib/db/schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const TYPES = [
  { name: 'Eye Exam', durationMinutes: 30, sortOrder: 0 },
  { name: 'Frame Fitting', durationMinutes: 30, sortOrder: 1 },
  { name: 'Lens Consultation', durationMinutes: 30, sortOrder: 2 },
  { name: 'Adjustment & Repair', durationMinutes: 15, sortOrder: 3 },
];

async function main() {
  console.log('Seeding appointment types…');
  for (const t of TYPES) {
    await db.insert(appointmentTypes).values(t).onConflictDoNothing();
  }
  console.log(`Done — ${TYPES.length} types seeded.`);
}

main().catch(console.error);
