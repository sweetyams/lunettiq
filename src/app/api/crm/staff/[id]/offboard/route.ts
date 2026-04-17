export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { appointments, secondSightIntakes } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { writeAudit } from '@/lib/crm/audit';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, and, sql } from 'drizzle-orm';

const clerkFetch = (path: string, opts?: RequestInit) =>
  fetch(`https://api.clerk.com/v1${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, 'Content-Type': 'application/json', ...opts?.headers },
  });

// Step 1: impact preview
export const GET = handler(async (_request, ctx) => {
  const session = await requireCrmAuth('org:settings:staff');
  const userId = ctx.params.id;

  const [apptCount, intakeCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(appointments)
      .where(and(eq(appointments.staffId, userId), sql`${appointments.status} IN ('scheduled', 'confirmed')`))
      .then(r => Number(r[0]?.count ?? 0)),
    db.select({ count: sql<number>`count(*)` }).from(secondSightIntakes)
      .where(and(eq(secondSightIntakes.staffId, userId), sql`${secondSightIntakes.status} IN ('draft', 'submitted')`))
      .then(r => Number(r[0]?.count ?? 0)),
  ]);

  return jsonOk({ appointmentCount: apptCount, intakeCount });
});

// Step 2: execute offboard
export const POST = handler(async (request, ctx) => {
  const session = await requireCrmAuth('org:settings:staff');
  const userId = ctx.params.id;
  const { confirmName } = await request.json();

  if (!confirmName) return jsonError('confirmName required', 400);

  // Verify name matches
  const userRes = await clerkFetch(`/users/${userId}`);
  if (!userRes.ok) return jsonError('User not found', 404);
  const user = await userRes.json();
  const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  if (confirmName.trim().toLowerCase() !== fullName.toLowerCase()) return jsonError('Name does not match', 400);

  // Reassign open work
  const [apptResult, intakeResult] = await Promise.all([
    db.update(appointments).set({ staffId: null, updatedAt: new Date() })
      .where(and(eq(appointments.staffId, userId), sql`${appointments.status} IN ('scheduled', 'confirmed')`))
      .returning({ id: appointments.id }),
    db.update(secondSightIntakes).set({ staffId: null, updatedAt: new Date() })
      .where(and(eq(secondSightIntakes.staffId, userId), sql`${secondSightIntakes.status} IN ('draft', 'submitted')`))
      .returning({ id: secondSightIntakes.id }),
  ]);

  // Ban user
  await clerkFetch(`/users/${userId}/ban`, { method: 'POST' });

  // Merge metadata (don't overwrite)
  const oldMeta = (user.public_metadata ?? {}) as Record<string, unknown>;
  await clerkFetch(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      public_metadata: { ...oldMeta, offboarded: true, offboarded_at: new Date().toISOString(), offboarded_by: session.userId },
    }),
  });

  await writeAudit({
    session, action: 'delete', entityType: 'staff', entityId: userId,
    diff: { appointmentsReassigned: apptResult.length, intakesReassigned: intakeResult.length },
  });

  return jsonOk({ id: userId, appointmentsReassigned: apptResult.length, intakesReassigned: intakeResult.length });
});
