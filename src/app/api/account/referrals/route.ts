export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { referrals } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { randomBytes } from 'crypto';

function extractId(gid: string) { return gid.replace(/^gid:\/\/shopify\/Customer\//, ''); }

async function requireCustomer() {
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) return process.env.DEV_CUSTOMER_ID;
  const token = getAccessToken();
  if (!token) throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return extractId((await getCustomerProfile(token)).id);
}

export async function GET() {
  let customerId;
  try { customerId = await requireCustomer(); } catch (e) { if (e instanceof NextResponse) return e; return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  // Get or create referral code
  let myRefs = await db.select().from(referrals).where(eq(referrals.referrerCustomerId, customerId)).orderBy(desc(referrals.createdAt));

  // Find their unique code (from any existing referral row)
  let code = myRefs[0]?.referrerCode;
  if (!code) {
    code = randomBytes(4).toString('hex');
    // Insert a placeholder so the code exists for /r/[code]
    await db.insert(referrals).values({ referrerCustomerId: customerId, referrerCode: code, status: 'expired' });
  }

  const pending = myRefs.filter(r => r.status === 'pending').length;
  const qualified = myRefs.filter(r => r.status === 'qualified').length;
  const totalEarned = myRefs.filter(r => r.status === 'qualified').reduce((sum, r) => sum + Number(r.referrerRewardAmount ?? 0), 0);

  return NextResponse.json({ data: { code, referralUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/r/${code}`, pending, qualified, totalEarned, referrals: myRefs.filter(r => r.status !== 'expired').slice(0, 20) } });
}
