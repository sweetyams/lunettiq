export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import {
  optionGroups, options, priceRules, constraintRules, stepDefinitions,
} from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';

// GET — list all product options data
export const GET = handler(async (request) => {
  await requireCrmAuth();
  const url = new URL(request.url);
  const entity = url.searchParams.get('entity');

  if (entity === 'groups') {
    return jsonOk(await db.select().from(optionGroups).orderBy(optionGroups.code));
  }
  if (entity === 'options') {
    return jsonOk(await db.select().from(options).orderBy(options.sortOrder));
  }
  if (entity === 'prices') {
    return jsonOk(await db.select().from(priceRules).orderBy(priceRules.code));
  }
  if (entity === 'constraints') {
    return jsonOk(await db.select().from(constraintRules).orderBy(constraintRules.code));
  }
  if (entity === 'steps') {
    return jsonOk(await db.select().from(stepDefinitions).orderBy(stepDefinitions.channel, stepDefinitions.sortOrder));
  }

  // Default: return everything
  const [g, o, p, c, s] = await Promise.all([
    db.select().from(optionGroups).orderBy(optionGroups.code),
    db.select().from(options).orderBy(options.sortOrder),
    db.select().from(priceRules).orderBy(priceRules.code),
    db.select().from(constraintRules).orderBy(constraintRules.code),
    db.select().from(stepDefinitions).orderBy(stepDefinitions.channel, stepDefinitions.sortOrder),
  ]);
  return jsonOk({ groups: g, options: o, priceRules: p, constraintRules: c, stepDefinitions: s });
});

// POST — create entity
export const POST = handler(async (request) => {
  await requireCrmAuth('org:settings:tags');
  const body = await request.json();
  const { entity, ...data } = body;

  if (entity === 'group') {
    const [row] = await db.insert(optionGroups).values(data).returning();
    return jsonOk(row);
  }
  if (entity === 'option') {
    const [row] = await db.insert(options).values(data).returning();
    return jsonOk(row);
  }
  if (entity === 'price') {
    const [row] = await db.insert(priceRules).values(data).returning();
    return jsonOk(row);
  }
  if (entity === 'constraint') {
    const [row] = await db.insert(constraintRules).values(data).returning();
    return jsonOk(row);
  }
  if (entity === 'step') {
    const [row] = await db.insert(stepDefinitions).values(data).returning();
    return jsonOk(row);
  }

  return jsonError('Unknown entity. Use: group, option, price, constraint, step', 400);
});

// PATCH — update entity by id
export const PATCH = handler(async (request) => {
  await requireCrmAuth('org:settings:tags');
  const body = await request.json();
  const { entity, id, ...data } = body;
  if (!id) return jsonError('id required', 400);

  const now = new Date();

  if (entity === 'group') {
    const [row] = await db.update(optionGroups).set({ ...data, updatedAt: now }).where(eq(optionGroups.id, id)).returning();
    return jsonOk(row);
  }
  if (entity === 'option') {
    const [row] = await db.update(options).set({ ...data, updatedAt: now }).where(eq(options.id, id)).returning();
    return jsonOk(row);
  }
  if (entity === 'price') {
    const [row] = await db.update(priceRules).set({ ...data, updatedAt: now }).where(eq(priceRules.id, id)).returning();
    return jsonOk(row);
  }
  if (entity === 'constraint') {
    const [row] = await db.update(constraintRules).set({ ...data, updatedAt: now }).where(eq(constraintRules.id, id)).returning();
    return jsonOk(row);
  }
  if (entity === 'step') {
    const [row] = await db.update(stepDefinitions).set({ ...data, updatedAt: now }).where(eq(stepDefinitions.id, id)).returning();
    return jsonOk(row);
  }

  return jsonError('Unknown entity', 400);
});

// DELETE — delete entity by id
export const DELETE = handler(async (request) => {
  await requireCrmAuth('org:settings:tags');
  const body = await request.json();
  const { entity, id } = body;
  if (!id) return jsonError('id required', 400);

  if (entity === 'group') {
    await db.delete(optionGroups).where(eq(optionGroups.id, id));
    return jsonOk({ deleted: id });
  }
  if (entity === 'option') {
    await db.delete(options).where(eq(options.id, id));
    return jsonOk({ deleted: id });
  }
  if (entity === 'price') {
    await db.delete(priceRules).where(eq(priceRules.id, id));
    return jsonOk({ deleted: id });
  }
  if (entity === 'constraint') {
    await db.delete(constraintRules).where(eq(constraintRules.id, id));
    return jsonOk({ deleted: id });
  }
  if (entity === 'step') {
    await db.delete(stepDefinitions).where(eq(stepDefinitions.id, id));
    return jsonOk({ deleted: id });
  }

  return jsonError('Unknown entity', 400);
});
