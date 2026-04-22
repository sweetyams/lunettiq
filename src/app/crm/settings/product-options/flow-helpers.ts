// Configurator Builder helpers — new schema
export interface E { id: string; [k: string]: unknown }

export function str(v: unknown) { return String(v ?? ''); }
export function num(v: unknown) { return Number(v ?? 0); }

const API = '/api/crm/configurator';
const H = { 'Content-Type': 'application/json' };
const C = { credentials: 'include' as const };

export async function cfgFetch() {
  const res = await fetch(API, C);
  if (!res.ok) throw new Error('Failed to load (' + res.status + ')');
  const d = await res.json();
  return d.data as {
    flows: E[]; steps: E[]; groups: E[]; choices: E[];
    placements: E[]; priceRules: E[]; ruleSets: E[]; rules: E[]; clauses: E[];
  };
}

export async function cfgCreate(entity: string, data: Record<string, unknown>) {
  const res = await fetch(API, { method: 'POST', headers: H, ...C, body: JSON.stringify({ entity, ...data }) });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Create failed'); }
  return (await res.json()).data as E;
}

export async function cfgUpdate(entity: string, id: string, data: Record<string, unknown>) {
  const res = await fetch(API, { method: 'PATCH', headers: H, ...C, body: JSON.stringify({ entity, id, ...data }) });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Update failed'); }
  return (await res.json()).data as E;
}

export async function cfgDelete(entity: string, id: string) {
  const res = await fetch(API, { method: 'DELETE', headers: H, ...C, body: JSON.stringify({ entity, id }) });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Delete failed'); }
}

// Resolve placement label (override or choice label)
export function placementLabel(placement: E, choiceMap: Map<string, E>) {
  if (placement.labelOverride) return str(placement.labelOverride);
  const choice = choiceMap.get(str(placement.choiceId));
  return choice ? str(choice.label) : str(placement.choiceId);
}

// Get price for a placement
export function placementPrice(placementId: string, priceRules: E[]) {
  const r = priceRules.find(p => str(p.ownerType) === 'group_choice' && str(p.ownerId) === placementId && str(p.status) !== 'inactive');
  if (!r) return null;
  return { amount: num(r.amount), type: str(r.ruleType), id: r.id };
}

export function formatPlacementPrice(placementId: string, priceRules: E[]) {
  const p = placementPrice(placementId, priceRules);
  if (!p || p.amount === 0) return 'included';
  return p.type === 'override' ? '$' + p.amount : '+$' + p.amount;
}
