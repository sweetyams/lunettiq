export const dynamic = "force-dynamic";
export const maxDuration = 120;
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { syncFromShopify } from '@/lib/crm/inventory-sync';

export const POST = handler(async () => {
  await requireCrmAuth('org:settings:integrations');
  const result = await syncFromShopify();
  return jsonOk({ message: `Synced ${result.synced} inventory levels across ${result.locations} locations` });
});
