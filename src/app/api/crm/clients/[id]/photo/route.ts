import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { customersProjection, auditLog } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';
import { uploadFile } from '@/lib/crm/shopify-admin';

export const POST = handler(async (request, ctx) => {
  const session = await requireCrmAuth('org:clients:update');
  const id = ctx.params.id;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return jsonError('file required', 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadFile(buffer, file.name, file.type);

  if (!result.ok) return jsonError(result.error, 502);

  // Store URL in metafield (would need metafield update)
  // For now just return the URL
  await db.insert(auditLog).values({
    action: 'update', entityType: 'customer', entityId: id,
    staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
    diff: { photo: result.data },
  });

  return jsonOk({ url: result.data });
});
