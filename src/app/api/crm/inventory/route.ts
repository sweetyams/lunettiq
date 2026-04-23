export const dynamic = "force-dynamic";
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { getLevels, adjust, recount, projectToChannels } from '@/lib/crm/inventory';

// GET /api/crm/inventory?productId=X | familyId=X | locationId=X
export const GET = handler(async (request) => {
  await requireCrmAuth('org:products:read');
  const p = request.nextUrl.searchParams;
  const levels = await getLevels({
    productId: p.get('productId') ?? undefined,
    familyId: p.get('familyId') ?? undefined,
    colour: p.get('colour') ?? undefined,
    variantId: p.get('variantId') ?? undefined,
    locationId: p.get('locationId') ?? undefined,
  });
  return jsonOk(levels);
});

// POST /api/crm/inventory — adjust, recount, or receive
export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:products:update');
  const body = await request.json();
  const { action, familyId, colour, variantId, locationId } = body;

  if (!locationId) return jsonError('locationId required', 400);

  if (action === 'adjust') {
    if (!body.field || body.delta === undefined || !body.reason) return jsonError('field, delta, reason required', 400);
    const level = await adjust({
      familyId, colour, variantId, locationId,
      field: body.field, delta: body.delta, reason: body.reason,
      referenceId: body.referenceId, referenceType: body.referenceType,
      staffId: session.userId, note: body.note,
    });
    await projectToChannels(familyId, colour, variantId);
    return jsonOk(level);
  }

  if (action === 'recount') {
    if (body.newOnHand === undefined) return jsonError('newOnHand required', 400);
    const level = await recount({
      familyId, colour, variantId, locationId,
      newOnHand: body.newOnHand, staffId: session.userId, note: body.note,
    });
    await projectToChannels(familyId, colour, variantId);
    return jsonOk(level);
  }

  if (action === 'receive') {
    if (!body.quantity) return jsonError('quantity required', 400);
    const level = await adjust({
      familyId, colour, variantId, locationId,
      field: 'on_hand', delta: body.quantity, reason: 'received',
      staffId: session.userId, note: body.note,
    });
    await projectToChannels(familyId, colour, variantId);
    return jsonOk(level);
  }

  return jsonError('action must be adjust, recount, or receive', 400);
});
