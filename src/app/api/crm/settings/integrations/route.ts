export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { integrationsConfig } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';
import { INTEGRATIONS } from '@/lib/crm/integration-registry';
import { invalidateIntegrationCache } from '@/lib/crm/integrations';

// GET: list all integrations with their status
export const GET = handler(async () => {
  await requireCrmAuth('org:settings:integrations');
  const configs = await db.select().from(integrationsConfig);
  const configMap = new Map(configs.map(c => [c.id, c]));

  const result = INTEGRATIONS.map(def => {
    const config = configMap.get(def.id);
    // Check env vars as fallback (existing integrations)
    const envConfigured = def.requiredKeys.every(k => !!process.env[k.key]);
    return {
      ...def,
      enabled: config?.enabled ?? envConfigured,
      configured: config?.configuredAt != null || envConfigured,
      configuredAt: config?.configuredAt ?? null,
      // Never expose secret values — only show which keys are set
      keysSet: def.requiredKeys.map(k => ({
        key: k.key, label: k.label, secret: k.secret,
        hasValue: !!(config?.keys as Record<string, string>)?.[k.key] || !!process.env[k.key],
      })),
    };
  });

  return jsonOk(result);
});

// PATCH: update integration config (enable/disable + keys)
export const PATCH = handler(async (request) => {
  const session = await requireCrmAuth('org:settings:integrations');
  const body = await request.json();
  const { id, enabled, keys } = body;

  if (!id) return jsonError('id required', 400);
  const def = INTEGRATIONS.find(i => i.id === id);
  if (!def) return jsonError('Unknown integration', 404);

  // Only owners can modify integrations
  if (session.role !== 'owner') return jsonError('Only owners can modify integrations', 403);

  const existing = await db.select().from(integrationsConfig).where(eq(integrationsConfig.id, id)).then(r => r[0]);
  const existingKeys = (existing?.keys ?? {}) as Record<string, string>;

  // Merge keys — only update provided ones, keep existing
  const mergedKeys = { ...existingKeys };
  if (keys) {
    for (const [k, v] of Object.entries(keys as Record<string, string>)) {
      if (v === '') delete mergedKeys[k]; // empty = remove
      else mergedKeys[k] = v;
    }
  }

  const values = {
    id,
    enabled: enabled ?? existing?.enabled ?? false,
    keys: mergedKeys,
    configuredAt: Object.keys(mergedKeys).length > 0 ? new Date() : null,
    configuredBy: session.userId,
    updatedAt: new Date(),
  };

  await db.insert(integrationsConfig).values(values)
    .onConflictDoUpdate({ target: integrationsConfig.id, set: { enabled: values.enabled, keys: values.keys, configuredAt: values.configuredAt, configuredBy: values.configuredBy, updatedAt: values.updatedAt } });

  invalidateIntegrationCache();

  return jsonOk({ id, enabled: values.enabled });
});
