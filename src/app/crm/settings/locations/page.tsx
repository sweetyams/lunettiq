import { requirePermission } from '@/lib/crm/auth';
import { db } from '@/lib/db';
import { locations } from '@/lib/db/schema';
import { LocationsClient } from './LocationsClient';

export default async function LocationsSettingsPage() {
  await requirePermission('org:settings:locations');
  const rows = await db.select().from(locations);
  return <LocationsClient locations={JSON.parse(JSON.stringify(rows))} />;
}
