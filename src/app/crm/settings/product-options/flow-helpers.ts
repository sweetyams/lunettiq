export interface Entity { id: string; [k: string]: unknown }

export function str(v: unknown) { return String(v ?? ''); }
export function num(v: unknown) { return Number(v ?? 0); }
export function hasChannel(ch: unknown, c: string) { return !Array.isArray(ch) || ch.includes(c); }

// Friendly labels for DB values
export const GROUP_LABELS: Record<string, string> = {
  lens_path: 'Lens Type', finish_state: 'Lens Finish', material: 'Material',
  treatment: 'Enhancements', shipping: 'Shipping', channel: 'Channel',
};

export const RULE_LABELS: Record<string, string> = {
  requires: 'Shown when', excludes: 'Not available with',
  allowed_only_with: 'Only shown with', hidden_until: 'Hidden until',
  default_if: 'Default when', defer_if_no_rx: 'Deferred without Rx',
};

export function friendlyGroupLabel(group: Entity) {
  return GROUP_LABELS[str(group.layer)] || str(group.label);
}

export function getCustomRules(optCode: string, siblingCodes: Set<string>, rules: Entity[]) {
  return rules.filter(r => {
    if (r.active === false || r.sourceOptionCode !== optCode) return false;
    if (str(r.ruleType) === 'excludes') {
      const targets = (r.targetOptionCodes as string[]) || [];
      if (siblingCodes.has(str(r.sourceOptionCode)) && targets.every(t => siblingCodes.has(t))) return false;
    }
    return true;
  });
}

export function countCustomRules(groupId: string, options: Entity[], rules: Entity[]) {
  const codes = new Set(options.filter(o => o.groupId === groupId).map(o => str(o.code)));
  return rules.filter(r => {
    if (r.active === false || !codes.has(str(r.sourceOptionCode))) return false;
    if (str(r.ruleType) === 'excludes') {
      const t = (r.targetOptionCodes as string[]) || [];
      if (t.every(x => codes.has(x))) return false;
    }
    return true;
  }).length;
}

export function getPrice(code: string, priceRules: Entity[], channel: string) {
  const r = priceRules.find(p =>
    p.active !== false && hasChannel(p.channels, channel) &&
    Array.isArray(p.optionCodes) && (p.optionCodes as string[]).includes(code));
  if (!r) return null;
  return { amount: num(r.amountCad), type: str(r.pricingType), id: r.id };
}

export function formatPrice(code: string, priceRules: Entity[], channel: string) {
  const p = getPrice(code, priceRules, channel);
  if (!p) return 'included';
  return p.type === 'absolute' ? '$' + p.amount : '+$' + p.amount;
}

export function conditionSummary(code: string, siblingCodes: Set<string>, rules: Entity[], lblMap: Map<string, string>) {
  const custom = getCustomRules(code, siblingCodes, rules);
  if (custom.length === 0) return 'No conditions';
  return custom.length + ' condition' + (custom.length > 1 ? 's' : '');
}

export function shownWhen(code: string, rules: Entity[], lblMap: Map<string, string>) {
  const avail = rules.filter(r => r.active !== false && r.sourceOptionCode === code && ['requires', 'allowed_only_with'].includes(str(r.ruleType)));
  if (avail.length === 0) return 'Always shown';
  const targets: string[] = [];
  for (const r of avail) for (const t of (r.targetOptionCodes as string[]) || []) targets.push(lblMap.get(t) || t);
  if (targets.length === 1) return 'Only with ' + targets[0];
  return 'Shown for ' + targets.length + ' choices';
}
