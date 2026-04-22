export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import {
  configuratorFlows, flowSteps, stepChoiceGroups, cfgChoices,
  groupChoices, ruleSets, cfgRules, ruleClauses, cfgPriceRules,
} from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';

const TABLES: Record<string, any> = {
  flow: configuratorFlows, step: flowSteps, group: stepChoiceGroups,
  choice: cfgChoices, placement: groupChoices,
  ruleSet: ruleSets, rule: cfgRules, clause: ruleClauses,
  priceRule: cfgPriceRules,
};

// GET — load full flow tree or entity list
export const GET = handler(async (request) => {
  await requireCrmAuth();
  const url = new URL(request.url);
  const entity = url.searchParams.get('entity');
  const flowId = url.searchParams.get('flowId');

  if (entity && TABLES[entity]) {
    return jsonOk(await db.select().from(TABLES[entity]));
  }

  // Default: load everything for all flows (or one flow)
  const [flows, steps, groups, choices, placements, pRules, rSets, rules, clauses] = await Promise.all([
    db.select().from(configuratorFlows),
    db.select().from(flowSteps).orderBy(flowSteps.orderIndex),
    db.select().from(stepChoiceGroups).orderBy(stepChoiceGroups.sortOrder),
    db.select().from(cfgChoices),
    db.select().from(groupChoices).orderBy(groupChoices.sortOrder),
    db.select().from(cfgPriceRules),
    db.select().from(ruleSets),
    db.select().from(cfgRules),
    db.select().from(ruleClauses),
  ]);
  return jsonOk({ flows, steps, groups, choices, placements, priceRules: pRules, ruleSets: rSets, rules, clauses });
});

// POST — create entity
export const POST = handler(async (request) => {
  await requireCrmAuth('org:settings:business_config');
  const { entity, ...data } = await request.json();
  const table = TABLES[entity];
  if (!table) return jsonError('Unknown entity: ' + entity, 400);
  const [row] = await db.insert(table).values(data).returning();
  return jsonOk(row);
});

// PATCH — update entity
export const PATCH = handler(async (request) => {
  await requireCrmAuth('org:settings:business_config');
  const { entity, id, ...data } = await request.json();
  if (!id) return jsonError('id required', 400);
  const table = TABLES[entity];
  if (!table) return jsonError('Unknown entity: ' + entity, 400);
  const pk = table.id;
  const [row] = await db.update(table).set({ ...data, updatedAt: new Date() }).where(eq(pk, id)).returning();
  return jsonOk(row);
});

// DELETE — delete entity
export const DELETE = handler(async (request) => {
  await requireCrmAuth('org:settings:business_config');
  const { entity, id } = await request.json();
  if (!id) return jsonError('id required', 400);
  const table = TABLES[entity];
  if (!table) return jsonError('Unknown entity: ' + entity, 400);
  await db.delete(table).where(eq(table.id, id));
  return jsonOk({ deleted: id });
});
