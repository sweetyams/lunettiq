export const dynamic = "force-dynamic";
export const maxDuration = 120;
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { syncFromShopify, syncFromSquare } from '@/lib/crm/inventory-sync';

export const POST = handler(async () => {
  await requireCrmAuth('org:settings:integrations');
  const start = Date.now();
  const [shopify, square] = await Promise.all([syncFromShopify(), syncFromSquare()]);
  const elapsed = Math.round((Date.now() - start) / 1000);
  return jsonOk({
    message: `Synced ${shopify.synced} from Shopify (${shopify.locations} loc), ${square.synced} from Square (${square.locations} loc) in ${elapsed}s`,
    shopify, square, elapsed,
  });
});
