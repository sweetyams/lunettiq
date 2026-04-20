export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { locations } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';

export const GET = handler(async () => {
  await requireCrmAuth();
  const rows = await db.select().from(locations).where(eq(locations.active, true));
  return jsonOk(rows);
});
