export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { archiveVotes, customersProjection } from '@/lib/db/schema';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { eq, and, sql, desc } from 'drizzle-orm';
import { getTierFromTags } from '@/lib/crm/loyalty-config';

function extractId(gid: string) { return gid.replace(/^gid:\/\/shopify\/Customer\//, ''); }

async function requireVaultCustomer() {
  let customerId: string;
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) {
    customerId = process.env.DEV_CUSTOMER_ID;
  } else {
    const token = getAccessToken();
    if (!token) throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    customerId = extractId((await getCustomerProfile(token)).id);
  }
  const client = await db.select({ tags: customersProjection.tags }).from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]);
  const tier = getTierFromTags(client?.tags ?? null);
  if (tier !== 'vault') throw NextResponse.json({ error: 'VAULT members only' }, { status: 403 });
  return customerId;
}

// GET — current year's vote results + user's vote
export async function GET() {
  let customerId: string;
  try { customerId = await requireVaultCustomer(); } catch (e) { if (e instanceof NextResponse) return e; return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const year = new Date().getFullYear();
  const myVote = await db.select().from(archiveVotes).where(and(eq(archiveVotes.year, year), eq(archiveVotes.shopifyCustomerId, customerId))).then(r => r[0]);
  const results = await db.select({ productHandle: archiveVotes.productHandle, count: sql<number>`count(*)` })
    .from(archiveVotes).where(eq(archiveVotes.year, year)).groupBy(archiveVotes.productHandle).orderBy(desc(sql`count(*)`));

  return NextResponse.json({ data: { year, myVote: myVote?.productHandle ?? null, results } });
}

// POST — cast vote
export async function POST(request: NextRequest) {
  let customerId: string;
  try { customerId = await requireVaultCustomer(); } catch (e) { if (e instanceof NextResponse) return e; return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { productHandle } = await request.json();
  if (!productHandle) return NextResponse.json({ error: 'productHandle required' }, { status: 400 });

  const year = new Date().getFullYear();
  await db.insert(archiveVotes).values({ year, shopifyCustomerId: customerId, productHandle })
    .onConflictDoUpdate({ target: [archiveVotes.year, archiveVotes.shopifyCustomerId], set: { productHandle } });

  return NextResponse.json({ data: { voted: productHandle } });
}
