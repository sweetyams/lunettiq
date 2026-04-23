export const dynamic = "force-dynamic";
export const maxDuration = 120;
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { syncFromShopify, syncFromSquare } from '@/lib/crm/inventory-sync';

export const POST = handler(async () => {
  await requireCrmAuth('org:settings:integrations');
  const [shopify, square] = await Promise.all([syncFromShopify(), syncFromSquare()]);
  return jsonOk({
    message: `Synced ${shopify.synced} from Shopify (${shopify.locations} locations), ${square.synced} from Square (${square.locations} locations)`,
  });
});
