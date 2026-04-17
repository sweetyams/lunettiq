export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { customersProjection, duplicateCandidates } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { or, eq } from 'drizzle-orm';

export const POST = handler(async () => {
  await requireCrmAuth('org:clients:merge');

  const customers = await db.select({
    id: customersProjection.shopifyCustomerId,
    email: customersProjection.email,
    phone: customersProjection.phone,
    firstName: customersProjection.firstName,
    lastName: customersProjection.lastName,
    tags: customersProjection.tags,
  }).from(customersProjection);

  const isMerged = (tags: string[] | null) => (tags ?? []).some(t => t.startsWith('merged-into-'));
  const active = customers.filter(c => !isMerged(c.tags));

  // Only skip pairs that are still pending or already merged — dismissed pairs can resurface
  const existing = await db.select({ a: duplicateCandidates.clientA, b: duplicateCandidates.clientB })
    .from(duplicateCandidates)
    .where(or(eq(duplicateCandidates.status, 'pending'), eq(duplicateCandidates.status, 'merged')));
  const pairSet = new Set(existing.map(e => [e.a, e.b].sort().join('|')));

  const toInsert: { clientA: string; clientB: string; matchReason: string; confidence: string }[] = [];

  function addPairs(ids: string[], matchReason: string, confidence: string) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const pair = [ids[i], ids[j]].sort().join('|');
        if (!pairSet.has(pair)) { pairSet.add(pair); toInsert.push({ clientA: ids[i], clientB: ids[j], matchReason, confidence }); }
      }
    }
  }

  // Exact email
  const byEmail = new Map<string, string[]>();
  for (const c of active) {
    if (!c.email) continue;
    const key = c.email.toLowerCase().trim();
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key)!.push(c.id);
  }
  for (const ids of Array.from(byEmail.values())) { if (ids.length >= 2) addPairs(ids, 'exact_email', '0.95'); }

  // Exact phone
  const byPhone = new Map<string, string[]>();
  for (const c of active) {
    if (!c.phone) continue;
    const key = c.phone.replace(/\D/g, '');
    if (!key) continue;
    if (!byPhone.has(key)) byPhone.set(key, []);
    byPhone.get(key)!.push(c.id);
  }
  for (const ids of Array.from(byPhone.values())) { if (ids.length >= 2) addPairs(ids, 'exact_phone', '0.90'); }

  // Exact normalized name
  const norm = (s: string | null) => (s ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const byName = new Map<string, string[]>();
  for (const c of active) {
    const key = norm(c.firstName) + '|' + norm(c.lastName);
    if (!key || key === '|') continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(c.id);
  }
  for (const ids of Array.from(byName.values())) { if (ids.length >= 2) addPairs(ids, 'exact_name', '0.80'); }

  if (toInsert.length) {
    await db.insert(duplicateCandidates).values(toInsert);
  }

  return jsonOk({ scanned: active.length, found: toInsert.length, emailGroups: Array.from(byEmail.values()).filter(v => v.length >= 2).length, phoneGroups: Array.from(byPhone.values()).filter(v => v.length >= 2).length, nameGroups: Array.from(byName.values()).filter(v => v.length >= 2).length, skippedExisting: pairSet.size });
});
