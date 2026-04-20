import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { referrals } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const code = params.code;
  const ref = await db.select().from(referrals).where(eq(referrals.referrerCode, code)).then(r => r[0]);
  if (!ref) return NextResponse.redirect(new URL('/', _req.url));

  const res = NextResponse.redirect(new URL('/?ref=' + code, _req.url));
  res.cookies.set('ref_code', code, { maxAge: 90 * 86400, path: '/', httpOnly: false });
  return res;
}
