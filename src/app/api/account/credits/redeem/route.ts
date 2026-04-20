export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { creditsLedger, creditCodes } from '@/lib/db/schema';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { eq, desc, and, sql } from 'drizzle-orm';

async function getCustomerId() {
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) return process.env.DEV_CUSTOMER_ID;
  const token = getAccessToken();
  if (!token) return null;
  return (await getCustomerProfile(token)).id.replace(/^gid:\/\/shopify\/Customer\//, '');
}

// GET: balance + active codes
export async function GET() {
  const customerId = await getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const lastEntry = await db.select({ balance: creditsLedger.runningBalance })
    .from(creditsLedger)
    .where(and(eq(creditsLedger.shopifyCustomerId, customerId), eq(creditsLedger.currency, 'credit')))
    .orderBy(desc(creditsLedger.createdAt)).limit(1).then(r => r[0]);

  const activeCodes = await db.select()
    .from(creditCodes)
    .where(and(eq(creditCodes.shopifyCustomerId, customerId), eq(creditCodes.status, 'active')))
    .orderBy(desc(creditCodes.createdAt));

  return NextResponse.json({ data: { balance: Number(lastEntry?.balance ?? 0), activeCodes } });
}

// POST: redeem credits — with safety guards
export async function POST(request: NextRequest) {
  const customerId = await getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { amount, method } = await request.json();
  if (!amount || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  if (!['gift_card', 'square_discount'].includes(method)) return NextResponse.json({ error: 'Invalid method' }, { status: 400 });

  // GUARD 1: Check real balance
  const lastEntry = await db.select({ balance: creditsLedger.runningBalance })
    .from(creditsLedger)
    .where(and(eq(creditsLedger.shopifyCustomerId, customerId), eq(creditsLedger.currency, 'credit')))
    .orderBy(desc(creditsLedger.createdAt)).limit(1).then(r => r[0]);

  const balance = Number(lastEntry?.balance ?? 0);
  if (balance <= 0) return NextResponse.json({ error: 'No credits available' }, { status: 400 });
  if (amount > balance) return NextResponse.json({ error: `Insufficient. Available: $${balance.toFixed(2)}` }, { status: 400 });

  // GUARD 2: Rate limit — no redemption within 10 seconds
  const recent = await db.select({ id: creditCodes.id }).from(creditCodes)
    .where(and(eq(creditCodes.shopifyCustomerId, customerId), sql`${creditCodes.createdAt} > now() - interval '10 seconds'`))
    .then(r => r[0]);
  if (recent) return NextResponse.json({ error: 'Please wait before redeeming again' }, { status: 429 });

  // STEP 1: Deduct balance FIRST (prevents double-spend)
  const newBalance = balance - amount;
  const [ledgerEntry] = await db.insert(creditsLedger).values({
    shopifyCustomerId: customerId, currency: 'credit', transactionType: 'redeemed_order',
    amount: String(-amount), runningBalance: String(newBalance),
    reason: method === 'gift_card' ? 'Redeemed online' : 'Redeemed in-store',
  }).returning();

  // STEP 2: Create the code/card
  let code: string;
  let fullCode: string | undefined;
  let giftCardId: string | undefined;

  if (method === 'gift_card') {
    const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
    const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
    const res = await fetch(`https://${SHOP}/admin/api/2024-01/gift_cards.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN! },
      body: JSON.stringify({ gift_card: { initial_value: amount.toFixed(2), currency: 'CAD', customer_id: Number(customerId), note: 'Lunettiq credit' } }),
    });
    const data = await res.json();

    if (!data.gift_card) {
      // ROLLBACK: return balance
      await db.insert(creditsLedger).values({
        shopifyCustomerId: customerId, currency: 'credit', transactionType: 'adjustment',
        amount: String(amount), runningBalance: String(balance),
        reason: 'Rollback: gift card creation failed',
      });
      return NextResponse.json({ error: 'Failed to create gift card' }, { status: 502 });
    }

    code = data.gift_card.last_characters;
    fullCode = data.gift_card.code;
    giftCardId = String(data.gift_card.id);
  } else {
    code = `LQ-${customerId.slice(-4)}-${Date.now().toString(36).toUpperCase()}`;
  }

  // STEP 3: Save code record
  await db.insert(creditCodes).values({
    shopifyCustomerId: customerId, method, code, amount: String(amount),
    shopifyGiftCardId: giftCardId ?? null, fullCode: fullCode ?? null,
  });

  // STEP 4: Link ledger entry to code
  await db.update(creditsLedger)
    .set({ relatedOrderId: method === 'gift_card' ? `gc_${giftCardId}` : `sq_${code}` })
    .where(eq(creditsLedger.id, ledgerEntry.id));

  return NextResponse.json({ data: { method, code, fullCode, amount, newBalance } });
}
