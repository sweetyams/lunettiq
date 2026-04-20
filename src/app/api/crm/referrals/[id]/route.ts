export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { referrals } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';

export const PATCH = handler(async (req, ctx) => {
  await requireCrmAuth('org:membership:update_status');
  const { action } = await req.json(); // 'approve' | 'reject'
  if (!['approve', 'reject'].includes(action)) return jsonError('action must be approve or reject', 400);

  const ref = await db.select().from(referrals).where(eq(referrals.id, ctx.params.id)).then(r => r[0]);
  if (!ref) return jsonError('Not found', 404);

  if (action === 'approve') {
    await db.update(referrals).set({ status: 'qualified', qualifiedAt: new Date() }).where(eq(referrals.id, ctx.params.id));
  } else {
    await db.update(referrals).set({ status: 'expired' }).where(eq(referrals.id, ctx.params.id));
  }

  return jsonOk({ id: ctx.params.id, action });
});
