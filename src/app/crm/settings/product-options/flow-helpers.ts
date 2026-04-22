// Helper types and functions for FlowEditor
export interface Entity { id: string; [k: string]: unknown }

export function str(v: unknown) { return String(v ?? ''); }
export function num(v: unknown) { return Number(v ?? 0); }
export function hasChannel(channels: unknown, ch: string) { return !Array.isArray(channels) || channels.includes(ch); }

export function getCustomRules(optCode: string, groupOptionCodes: Set<string>, constraintRules: Entity[]) {
  return constraintRules.filter(r => {
    if (r.active === false || r.sourceOptionCode !== optCode) return false;
    if (str(r.ruleType) === 'excludes') {
      const targets = (r.targetOptionCodes as string[]) || [];
      if (groupOptionCodes.has(str(r.sourceOptionCode)) && targets.every(t => groupOptionCodes.has(t))) return false;
    }
    return true;
  });
}

export function countCustomRules(groupId: string, options: Entity[], constraintRules: Entity[]) {
  const codes = new Set(options.filter(o => o.groupId === groupId).map(o => str(o.code)));
  return constraintRules.filter(r => {
    if (r.active === false || !codes.has(str(r.sourceOptionCode))) return false;
    if (str(r.ruleType) === 'excludes') {
      const targets = (r.targetOptionCodes as string[]) || [];
      if (targets.every(t => codes.has(t))) return false;
    }
    return true;
  }).length;
}

export function getPrice(optCode: string, priceRules: Entity[], channel: string) {
  const rule = priceRules.find(p =>
    p.active !== false && hasChannel(p.channels, channel) &&
    Array.isArray(p.optionCodes) && (p.optionCodes as string[]).includes(optCode));
  if (!rule) return null;
  return { amount: num(rule.amountCad), type: str(rule.pricingType), id: rule.id };
}

export function formatPrice(optCode: string, priceRules: Entity[], channel: string) {
  const p = getPrice(optCode, priceRules, channel);
  if (!p) return 'included';
  return p.type === 'absolute' ? `$${p.amount}` : `+$${p.amount}`;
}

export function availability(optCode: string, constraintRules: Entity[], labelMap: Map<string, string>) {
  const rules = constraintRules.filter(r =>
    r.active !== false && r.sourceOptionCode === optCode &&
    ['requires', 'allowed_only_with'].includes(str(r.ruleType)));
  if (rules.length === 0) return 'Always available';
  const targets: string[] = [];
  for (const r of rules) {
    for (const t of (r.targetOptionCodes as string[]) || []) {
      targets.push(labelMap.get(t) || t);
    }
  }
  if (targets.length === 1) return 'Only with ' + targets[0];
  return 'Available for ' + targets.length + ' options';
}

export function exceptions(optCode: string, groupOptionCodes: Set<string>, constraintRules: Entity[], labelMap: Map<string, string>) {
  const rules = getCustomRules(optCode, groupOptionCodes, constraintRules)
    .filter(r => !['requires', 'allowed_only_with'].includes(str(r.ruleType)));
  if (rules.length === 0) return '';
  return rules.map(r => {
    const targets = ((r.targetOptionCodes as string[]) || []).map(t => labelMap.get(t) || t);
    const type = str(r.ruleType);
    if (type === 'excludes') return 'Not with ' + targets.join(', ');
    if (type === 'hidden_until') return 'Hidden until ' + targets.join(', ');
    return type + ': ' + targets.join(', ');
  }).join(' · ');
}
