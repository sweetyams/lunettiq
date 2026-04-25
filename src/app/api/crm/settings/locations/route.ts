export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { locations } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, asc } from 'drizzle-orm';

export const GET = handler(async (request) => {
  await requireCrmAuth();
  const rows = await db.select().from(locations).orderBy(asc(locations.name));

  // Optionally include channel locations for linking UI
  const includeSquare = request.nextUrl.searchParams.get('squareList');
  let squareLocations: Array<{ id: string; name: string }> = [];
  let shopifyLocations: Array<{ id: string; name: string }> = [];
  if (includeSquare) {
    try {
      const { getKey } = await import('@/lib/crm/integration-keys');
      const token = await getKey('SQUARE_ACCESS_TOKEN');
      if (token) {
        const { listLocations } = await import('@/lib/square/client');
        squareLocations = (await listLocations()).map(l => ({ id: l.id, name: l.name }));
      }
    } catch {}
    try {
      const { graphqlAdmin } = await import('@/lib/shopify/admin-graphql');
      const result = await graphqlAdmin<any>(`{ locations(first: 50) { nodes { id name isActive } } }`);
      if (result.ok) {
        shopifyLocations = (result.data?.locations?.nodes ?? []).map((l: any) => ({
          id: l.id.replace('gid://shopify/Location/', ''), name: l.name, active: l.isActive ?? true,
        }));
      }
    } catch {}
  }

  // Include environment info so UI can show which store/env is connected
  let shopifyDomain: string | null = null;
  let squareEnvironment: string | null = null;
  if (includeSquare) {
    try {
      const { getKey } = await import('@/lib/crm/integration-keys');
      shopifyDomain = await getKey('NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN');
    } catch {}
    squareEnvironment = process.env.SQUARE_ENVIRONMENT ?? 'sandbox';
  }

  return jsonOk(includeSquare ? { locations: rows, squareLocations, shopifyLocations, shopifyDomain, squareEnvironment } : rows);
});

export const POST = handler(async (req) => {
  await requireCrmAuth('org:settings:business_config');
  const data = await req.json();
  if (!data.name?.trim()) return jsonError('name required', 400);
  const id = `loc_${data.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const existing = await db.select({ id: locations.id }).from(locations).where(eq(locations.id, id));
  if (existing.length) return jsonError('Location with this name already exists', 409);
  const [row] = await db.insert(locations).values({
    id,
    name: data.name.trim(),
    locationType: data.locationType ?? 'retail',
    timezone: data.timezone ?? 'America/Montreal',
    fulfillsOnline: data.fulfillsOnline ?? false,
    active: true,
  }).returning();
  return jsonOk(row);
});

export const PATCH = handler(async (req) => {
  await requireCrmAuth('org:settings:business_config');
  const { id, ...data } = await req.json();
  if (!id) return jsonError('id required', 400);
  const [row] = await db.update(locations).set(data).where(eq(locations.id, id)).returning();
  if (!row) return jsonError('Not found', 404);
  return jsonOk(row);
});

export const DELETE = handler(async (req) => {
  await requireCrmAuth('org:settings:business_config');
  const { id } = await req.json();
  if (!id) return jsonError('id required', 400);
  const [row] = await db.delete(locations).where(eq(locations.id, id)).returning();
  if (!row) return jsonError('Not found', 404);
  return jsonOk({ deleted: true });
});
