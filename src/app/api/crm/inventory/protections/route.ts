export const dynamic = "force-dynamic";
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { createProtection, releaseProtection, listProtections } from '@/lib/crm/inventory';

// GET /api/crm/inventory/protections?familyId=X&colour=X&locationId=X&activeOnly=true
export const GET = handler(async (request) => {
  await requireCrmAuth('org:products:read');
  const p = request.nextUrl.searchParams;
  const rows = await listProtections({
    familyId: p.get('familyId') ?? undefined,
    colour: p.get('colour') ?? undefined,
    locationId: p.get('locationId') ?? undefined,
    activeOnly: p.get('activeOnly') !== 'false',
  });
  return jsonOk(rows);
});

// POST /api/crm/inventory/protections — create or release
export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:products:update');
  const body = await request.json();

  if (body.action === 'release') {
    if (!body.id) return jsonError('id required', 400);
    // Staff can release their own; managers can release any
    const role = session.role;
    if (!['owner', 'manager'].includes(role)) {
      const existing = await listProtections({ activeOnly: true });
      const target = existing.find(p => p.id === body.id);
      if (target && target.staffId !== session.userId) {
        return jsonError('Only managers can release other staff holds', 403);
      }
    }
    const row = await releaseProtection(body.id);
    return row ? jsonOk(row) : jsonError('Protection not found or already released', 404);
  }

  // Create
  if (!body.familyId || !body.colour || !body.locationId || !body.reason) {
    return jsonError('familyId, colour, locationId, reason required', 400);
  }
  const row = await createProtection({
    familyId: body.familyId, colour: body.colour, locationId: body.locationId,
    quantity: body.quantity, scope: body.scope, reason: body.reason,
    referenceId: body.referenceId, referenceType: body.referenceType,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    staffId: session.userId, note: body.note,
  });
  return jsonOk(row, 201);
});
