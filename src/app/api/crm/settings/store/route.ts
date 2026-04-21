export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { storeSettings } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { getAllSettings, invalidateSettingsCache } from '@/lib/crm/store-settings';

export const GET = handler(async () => {
  await requireCrmAuth('org:settings:staff');
  const settings = await getAllSettings();
  return jsonOk(settings);
});

export const PATCH = handler(async (request) => {
  await requireCrmAuth('org:settings:staff');
  const body = await request.json() as Record<string, string>;

  for (const [key, value] of Object.entries(body)) {
    await db.insert(storeSettings).values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: storeSettings.key, set: { value, updatedAt: new Date() } });
  }

  invalidateSettingsCache();
  return jsonOk({ updated: Object.keys(body).length });
});
