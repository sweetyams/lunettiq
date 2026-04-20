export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { staffSchedules } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, and } from 'drizzle-orm';

// GET /api/crm/staff/[id]/schedule
export const GET = handler(async (_req, ctx) => {
  await requireCrmAuth('org:appointments:read');
  const rows = await db.select().from(staffSchedules)
    .where(eq(staffSchedules.staffId, ctx.params.id));
  return jsonOk(rows);
});

// PUT /api/crm/staff/[id]/schedule — replace entire schedule
export const PUT = handler(async (req, ctx) => {
  await requireCrmAuth('org:settings:staff');
  const staffId = ctx.params.id;
  const body: { dayOfWeek: number; startTime: string; endTime: string; locationId?: string }[] = await req.json();

  await db.delete(staffSchedules).where(eq(staffSchedules.staffId, staffId));

  if (body.length > 0) {
    await db.insert(staffSchedules).values(
      body.map(b => ({ staffId, dayOfWeek: b.dayOfWeek, startTime: b.startTime, endTime: b.endTime, locationId: b.locationId ?? null }))
    );
  }

  const rows = await db.select().from(staffSchedules).where(eq(staffSchedules.staffId, staffId));
  return jsonOk(rows);
});
