import { db } from '@/lib/db';
import { locations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import AppointmentsClient from './AppointmentsClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AppointmentsPage() {
  const locs = await db.select({ id: locations.id, name: locations.name, address: locations.address })
    .from(locations).where(eq(locations.active, true));

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <Link href="/account" className="text-sm text-gray-400 hover:text-black mb-6 inline-block">← My Account</Link>
      <AppointmentsClient locations={JSON.parse(JSON.stringify(locs))} />
    </div>
  );
}
