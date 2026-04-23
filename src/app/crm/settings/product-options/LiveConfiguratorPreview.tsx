'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { FlowData, FlowSelection } from './FlowEditor';
import { E, str, num, placementLabel, placementDescription, formatPlacementPrice } from './flow-helpers';
import { ProductSearchModal } from '@/components/crm/ProductSearchModal';

interface TestProduct {
  id: string;
  title: string;
  imageUrl: string | null;
  price: number;
}

interface Props {
  data: FlowData | null;
  selection: FlowSelection;
}

type TreeGroup = E & { placements: E[] };
type TreeStep = E & { groups: TreeGroup[] };

/* ── Rule evaluation engine ── */

/** Build a set of all selected choice IDs, keyed by groupId */
function buildSelectionIndex(selections: Record<string, Set<string>>, placements: E[]) {
  // Map: groupId → Set<choiceId>
  const byGroup = new Map<string, Set<string>>();
  // Map: placementId → choiceId
  const plToChoice = new Map<string, string>();
  for (const pl of placements) plToChoice.set(pl.id, str(pl.choiceId));

  for (const [groupId, plIds] of Object.entries(selections)) {
    const choiceIds = new Set<string>();
    Array.from(plIds).forEach(plId => {
      const cid = plToChoice.get(plId);
      if (cid) choiceIds.add(cid);
    });
    byGroup.set(groupId, choiceIds);
  }
  return byGroup;
}

function evaluateClause(
  clause: E,
  selectionsByGroup: Map<string, Set<string>>,
): boolean {
  const op = str(clause.operator);
  const leftType = str(clause.leftOperandType);
  const leftRef = str(clause.leftOperandRef);
  const rightRef = str(clause.rightOperandRef);

  // "selection" operand: leftRef is a groupId, we check what's selected there
  if (leftType === 'selection') {
    const selected = selectionsByGroup.get(leftRef) ?? new Set<string>();
    const rightValues = rightRef.split(',').map(s => s.trim()).filter(Boolean);

    switch (op) {
      case 'selected':       return selected.size > 0;
      case 'not_selected':   return selected.size === 0;
      case 'is':             return rightValues.length > 0 && selected.has(rightValues[0]);
      case 'is_not':         return rightValues.length > 0 && !selected.has(rightValues[0]);
      case 'is_any_of':      return rightValues.some(v => selected.has(v));
      case 'is_none_of':     return !rightValues.some(v => selected.has(v));
    }
  }

  // "choice" operand: leftRef is a choiceId, check if it's selected anywhere
  if (leftType === 'choice') {
    let isSelected = false;
    selectionsByGroup.forEach(set => { if (set.has(leftRef)) isSelected = true; });
    switch (op) {
      case 'selected':     return isSelected;
      case 'not_selected': return !isSelected;
    }
  }

  // Unknown clause type — default to passing
  return true;
}

function evaluateRuleSet(
  ruleSetId: string,
  ruleSets: E[],
  rules: E[],
  clauses: E[],
  selectionsByGroup: Map<string, Set<string>>,
): boolean {
  const rs = ruleSets.find(r => r.id === ruleSetId && str(r.status) !== 'archived');
  if (!rs) return true; // no rule set → always visible

  const logic = str(rs.logicOperator) || 'AND';
  const setRules = rules.filter(r => r.ruleSetId === ruleSetId && str(r.status) !== 'archived');
  if (setRules.length === 0) return true;

  const results = setRules.map(rule => {
    const ruleClauses = clauses.filter(c => c.ruleId === rule.id);
    if (ruleClauses.length === 0) return true;
    return ruleClauses.every(c => evaluateClause(c, selectionsByGroup));
  });

  return logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

export default function LiveConfiguratorPreview({ data, selection }: Props) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [testProduct, setTestProduct] = useState<TestProduct | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [lensColours, setLensColours] = useState<Record<string, { id: string; code: string; label: string; hex: string | null; hexEnd: string | null; price: string; category: string | null; shortDescription: string | null }[]>>({});

  useEffect(() => {
    fetch('/api/crm/settings/lens-colours', { credentials: 'include' })
      .then(r => r.json()).then(d => {
        const bySet: typeof lensColours = {};
        for (const c of d.data?.colours ?? []) { if (!bySet[c.setId]) bySet[c.setId] = []; bySet[c.setId].push(c); }
        for (const arr of Object.values(bySet)) arr.sort((a, b) => (a as any).sortOrder - (b as any).sortOrder);
        setLensColours(bySet);
      }).catch(() => {});
  }, []);

  const flow = data?.flows?.find(f => f.id === selection.flowId) ?? null;

  const steps = useMemo(() =>
    (data?.steps ?? []).filter(s => s.flowId === selection.flowId && str(s.status) !== 'archived').sort((a, b) => num(a.orderIndex) - num(b.orderIndex)),
    [data?.steps, selection.flowId]);

  const choiceMap = useMemo(() => {
    const m = new Map<string, E>();
    (data?.choices ?? []).forEach(c => m.set(c.id, c));
    return m;
  }, [data?.choices]);

  const allPlacements = data?.placements ?? [];

  // Selection index for rule evaluation: groupId → Set<choiceId>
  const selectionsByGroup = useMemo(
    () => buildSelectionIndex(selections, allPlacements),
    [selections, allPlacements],
  );

  // Evaluate placement availability
  const isPlacementAvailable = useCallback((pl: E): boolean => {
    const rsId = str(pl.availabilityRuleSetId);
    if (!rsId) return true; // no rule → always visible
    return evaluateRuleSet(rsId, data?.ruleSets ?? [], data?.rules ?? [], data?.clauses ?? [], selectionsByGroup);
  }, [data?.ruleSets, data?.rules, data?.clauses, selectionsByGroup]);

  async function handleProductSelect(product: { id: string; title: string }) {
    setProductPickerOpen(false);
    setLoadingProduct(true);
    try {
      const res = await fetch(`/api/crm/products/${product.id}`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        const p = d.data ?? d;
        const imgs = (p.images ?? []) as Array<string | { src?: string }>;
        const imageUrl = typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.src ?? null;
        setTestProduct({ id: p.shopifyProductId, title: p.title, imageUrl, price: Number(p.priceMin ?? 0) });
      }
    } catch { /* ignore */ }
    setLoadingProduct(false);
  }

  // Build step tree with rule-filtered placements, filtering out hidden steps
  const stepTree: TreeStep[] = useMemo(() => steps
    .filter(step => {
      const rsId = str(step.visibilityRuleSetId);
      if (!rsId) return true;
      return evaluateRuleSet(rsId, data?.ruleSets ?? [], data?.rules ?? [], data?.clauses ?? [], selectionsByGroup);
    })
    .map(step => {
    const groups = (data?.groups ?? [])
      .filter(g => g.stepId === step.id && str(g.status) !== 'archived')
      .sort((a, b) => num(a.sortOrder) - num(b.sortOrder));

    return {
      ...step,
      groups: groups.map(group => ({
        ...group,
        placements: allPlacements
          .filter(p => p.groupId === group.id && str(p.status) !== 'archived' && p.isVisible !== false)
          .filter(isPlacementAvailable)
          .sort((a, b) => num(a.sortOrder) - num(b.sortOrder)),
      })),
    };
  }), [steps, data?.groups, allPlacements, isPlacementAvailable, data?.ruleSets, data?.rules, data?.clauses, selectionsByGroup]);

  const activeStep = stepTree[currentStepIdx] ?? stepTree[0];

  function toggleChoice(groupId: string, placementId: string, mode: string, autoAdvance?: boolean) {
    setSelections(prev => {
      const next = { ...prev };
      const set = new Set(prev[groupId] ?? []);
      if (mode === 'single') {
        if (set.has(placementId)) set.clear();
        else { set.clear(); set.add(placementId); }
      } else {
        if (set.has(placementId)) set.delete(placementId);
        else set.add(placementId);
      }
      next[groupId] = set;
      return next;
    });
    if (autoAdvance && mode === 'single') {
      setTimeout(() => setCurrentStepIdx(i => Math.min(i + 1, stepTree.length - 1)), 200);
    }
  }

  // Running total
  const runningTotal = useMemo(() => {
    let total = testProduct?.price ?? 0;
    for (const [, chosen] of Object.entries(selections)) {
      Array.from(chosen).forEach(plId => {
        const priceStr = formatPlacementPrice(plId, data?.priceRules ?? []);
        const match = priceStr.match(/\$(\d+(?:\.\d+)?)/);
        if (match) total += parseFloat(match[1]);
      });
    }
    return total;
  }, [selections, data?.priceRules, testProduct?.price]);

  // Build summary lines from all selections
  const summaryLines = useMemo(() => {
    const lines: { stepLabel: string; label: string; amount: number }[] = [];
    for (const step of stepTree) {
      for (const group of step.groups) {
        const chosen = selections[group.id];
        if (!chosen || chosen.size === 0) continue;
        Array.from(chosen).forEach(plId => {
          const pl = group.placements.find(p => p.id === plId);
          if (!pl) return;
          const choice = choiceMap.get(str(pl.choiceId));
          const cType = choice ? str(choice.choiceType) || 'standard' : 'standard';
          const label = placementLabel(pl, choiceMap);

          if (cType === 'colour') {
            // Price from selected colour
            const colourSelKey = `${group.id}:${plId}:colour`;
            const colourId = (selections as any)[colourSelKey]?.values().next().value as string | undefined;
            const setId = choice ? str(choice.lensColourSetId) : '';
            const colours = lensColours[setId] ?? [];
            const colour = colourId ? colours.find(c => c.id === colourId) : null;
            if (colour) {
              lines.push({ stepLabel: str(step.label), label: `${label}: ${colour.label}`, amount: Number(colour.price) || 0 });
            }
          } else if (cType !== 'content') {
            const priceStr = formatPlacementPrice(plId, data?.priceRules ?? []);
            const match = priceStr.match(/\$(\d+(?:\.\d+)?)/);
            lines.push({ stepLabel: str(step.label), label, amount: match ? parseFloat(match[1]) : 0 });
          }
        });
      }
    }
    return lines;
  }, [stepTree, selections, data?.priceRules, choiceMap, lensColours]);

  if (!flow || stepTree.length === 0) {
    return (
      <div className="crm-card" style={{ padding: 32, textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 13 }}>
        {!flow ? 'Select a flow to preview.' : 'No steps defined for this flow yet.'}
      </div>
    );
  }

  return (
    <div className="crm-card" style={{ overflow: 'hidden' }}>
      {/* Header with product picker */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--crm-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, background: 'var(--crm-surface-hover)', padding: '2px 8px', borderRadius: 4, color: 'var(--crm-text-tertiary)' }}>Preview</span>
          {testProduct ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {testProduct.imageUrl && (
                <img src={testProduct.imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
              )}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{testProduct.title}</div>
                <div style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>Base ${testProduct.price.toFixed(2)}</div>
              </div>
              <button className="crm-btn crm-btn-ghost" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => setProductPickerOpen(true)}>Change</button>
            </div>
          ) : (
            <button className="crm-btn crm-btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} disabled={loadingProduct} onClick={() => setProductPickerOpen(true)}>
              {loadingProduct ? 'Loading…' : '+ Select a product to test'}
            </button>
          )}
        </div>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {runningTotal > 0 ? `$${runningTotal.toFixed(2)}` : ''}
        </span>
      </div>

      <ProductSearchModal
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onSelect={handleProductSelect}
      />

      {/* Two-column: steps left, summary right */}
      <div style={{ display: 'flex', gap: 0, minHeight: 300 }}>
        <div style={{ flex: 2, borderRight: '1px solid var(--crm-border-light)' }}>
      {/* Step progress */}
      <div style={{ display: 'flex', padding: '10px 16px', gap: 4, borderBottom: '1px solid var(--crm-border-light)' }}>
        {stepTree.map((step, i) => {
          const isCurrent = i === currentStepIdx;
          const isPast = i < currentStepIdx;
          return (
            <button key={step.id} onClick={() => setCurrentStepIdx(i)} style={{
              flex: 1, padding: '6px 0', border: 'none', cursor: 'pointer', background: 'none', textAlign: 'center',
            }}>
              <div style={{
                height: 3, borderRadius: 2, marginBottom: 6,
                background: isPast ? 'var(--crm-text-primary)' : isCurrent ? 'var(--crm-text-primary)' : 'var(--crm-border)',
                opacity: isCurrent ? 1 : isPast ? 0.6 : 0.3,
              }} />
              <span style={{
                fontSize: 11, fontWeight: isCurrent ? 600 : 400,
                color: isCurrent ? 'var(--crm-text-primary)' : 'var(--crm-text-tertiary)',
              }}>{str(step.label)}</span>
            </button>
          );
        })}
      </div>

      {/* Active step content */}
      {activeStep && (
        <div style={{ padding: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>{str(activeStep.label)}</h3>
          <p style={{ fontSize: 11, color: 'var(--crm-text-tertiary)', margin: '0 0 16px' }}>
            {activeStep.groups.length === 1 && str(activeStep.groups[0].selectionMode) === 'single' ? 'Choose one option' : 'Configure your preferences'}
          </p>

          {activeStep.groups.map((group: TreeGroup) => {
            const mode = str(group.selectionMode);
            const chosen = selections[group.id] ?? new Set();

            return (
              <div key={group.id} style={{ marginBottom: 16 }}>
                {activeStep.groups.length > 1 && (
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--crm-text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {str(group.label)}{group.isRequired ? '' : ' (optional)'}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {group.placements.map((pl: E) => {
                    const choice = choiceMap.get(str(pl.choiceId));
                    const cType = choice ? str(choice.choiceType) || 'standard' : 'standard';
                    const label = placementLabel(pl, choiceMap);
                    const desc = placementDescription(pl, choiceMap);
                    const price = formatPlacementPrice(pl.id, data?.priceRules ?? []);
                    const isChosen = chosen.has(pl.id);

                    // Content: display only
                    if (cType === 'content') {
                      return (
                        <div key={pl.id} style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid var(--crm-border)', background: 'var(--crm-surface)' }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                          {desc && <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)', marginTop: 4 }}>{desc}</div>}
                          {choice?.contentBody && <div style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginTop: 4 }}>{String(choice.contentBody)}</div>}
                        </div>
                      );
                    }

                    // Colour: selectable + swatch expander
                    if (cType === 'colour') {
                      const setId = choice ? str(choice.lensColourSetId) : '';
                      const colours = lensColours[setId] ?? [];
                      const colourSelKey = `${group.id}:${pl.id}:colour`;
                      const chosenColourId = (selections as any)[colourSelKey]?.values().next().value as string | undefined;
                      const chosenColour = chosenColourId ? colours.find(c => c.id === chosenColourId) : null;
                      const colourPrice = chosenColour && Number(chosenColour.price) > 0 ? `+$${chosenColour.price}` : 'included';
                      return (
                        <div key={pl.id}>
                          <button onClick={() => toggleChoice(group.id, pl.id, mode, false)} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                            padding: '10px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                            border: `1.5px solid ${isChosen ? 'var(--crm-text-primary)' : 'var(--crm-border)'}`,
                            background: isChosen ? 'var(--crm-surface-active, rgba(0,0,0,0.03))' : 'transparent',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${isChosen ? 'var(--crm-text-primary)' : 'var(--crm-border)'}`, background: isChosen ? 'var(--crm-text-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {isChosen && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                              </span>
                              <div>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
                                {isChosen && chosenColour && <span style={{ fontSize: 11, color: 'var(--crm-text-tertiary)', marginLeft: 6 }}>— {chosenColour.label}</span>}
                              </div>
                            </div>
                            <span style={{ fontSize: 12, color: isChosen && colourPrice !== 'included' ? 'var(--crm-text-secondary)' : 'var(--crm-text-tertiary)', fontWeight: isChosen && colourPrice !== 'included' ? 500 : 400 }}>{isChosen ? colourPrice : price}</span>
                          </button>
                          {isChosen && colours.length > 0 && (
                            <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {colours.map(c => {
                                const sel = chosenColourId === c.id;
                                const bg = c.hexEnd ? `linear-gradient(180deg, ${c.hex} 0%, ${c.hexEnd} 100%)` : (c.hex || '#ddd');
                                const cp = Number(c.price) > 0 ? `+$${c.price}` : '';
                                return (
                                  <button key={c.id} onClick={() => { const s = new Set<string>(); s.add(c.id); setSelections(prev => ({ ...prev, [colourSelKey]: s })); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 18, background: bg, border: sel ? '2.5px solid var(--crm-text-primary)' : '2px solid var(--crm-border)', transition: 'border 120ms' }} />
                                    <span style={{ fontSize: 9, color: sel ? 'var(--crm-text-primary)' : 'var(--crm-text-tertiary)', fontWeight: sel ? 600 : 400, maxWidth: 48, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                                    {cp && <span style={{ fontSize: 8, color: sel ? 'var(--crm-success)' : 'var(--crm-text-tertiary)' }}>{cp}</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Standard + Product: selectable row
                    return (
                      <button key={pl.id} onClick={() => toggleChoice(group.id, pl.id, mode, !!activeStep.autoAdvance)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                        border: `1.5px solid ${isChosen ? 'var(--crm-text-primary)' : 'var(--crm-border)'}`,
                        background: isChosen ? 'var(--crm-surface-active, rgba(0,0,0,0.03))' : 'transparent',
                        transition: 'border-color 120ms, background 120ms',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {!activeStep.autoAdvance && <span style={{
                                width: 18, height: 18, borderRadius: mode === 'single' ? '50%' : 4,
                                border: `2px solid ${isChosen ? 'var(--crm-text-primary)' : 'var(--crm-border)'}`,
                                background: isChosen ? 'var(--crm-text-primary)' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, transition: 'all 120ms',
                              }}>
                                {isChosen && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                              </span>}
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
                              {str(pl.badge) && <span style={{ fontSize: 9, fontWeight: 600, background: 'var(--crm-text-primary)', color: '#fff', padding: '1px 6px', borderRadius: 3 }}>{str(pl.badge)}</span>}
                            </div>
                            {desc && <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)', marginTop: 3, marginLeft: activeStep.autoAdvance ? 0 : 28 }}>{desc}</div>}
                          </div>
                          <span style={{ fontSize: 12, color: price === 'included' ? 'var(--crm-text-tertiary)' : 'var(--crm-text-secondary)', fontWeight: price === 'included' ? 400 : 500, flexShrink: 0, marginLeft: 8 }}>
                          {price}
                        </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Nav buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button className="crm-btn crm-btn-secondary" style={{ fontSize: 12, padding: '6px 16px' }} disabled={currentStepIdx === 0} onClick={() => setCurrentStepIdx(i => i - 1)}>
              ← Back
            </button>
            {!activeStep.autoAdvance && (
              <button className="crm-btn crm-btn-primary" style={{ fontSize: 12, padding: '6px 16px' }} disabled={currentStepIdx === stepTree.length - 1} onClick={() => setCurrentStepIdx(i => i + 1)}>
                Continue →
              </button>
            )}
          </div>
        </div>
      )}
        </div>{/* end left column */}

        {/* Right column: summary */}
        <div style={{ flex: 1, padding: 16, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--crm-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Summary</div>
          {testProduct && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
              <span>{testProduct.title}</span>
              <span style={{ fontWeight: 500 }}>${testProduct.price.toFixed(2)}</span>
            </div>
          )}
          {summaryLines.map((line, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: 'var(--crm-text-secondary)' }}>
              <span>{line.stepLabel} → {line.label}</span>
              <span style={{ fontWeight: 500, flexShrink: 0, marginLeft: 8 }}>{line.amount === 0 ? 'included' : '+$' + line.amount.toFixed(2)}</span>
            </div>
          ))}
          {(testProduct || summaryLines.length > 0) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, padding: '8px 0 0', marginTop: 6, borderTop: '1px solid var(--crm-border-light)' }}>
              <span>Total</span>
              <span>${runningTotal.toFixed(2)}</span>
            </div>
          )}
          {!testProduct && summaryLines.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)', fontStyle: 'italic' }}>Make selections to see pricing</div>
          )}
        </div>
      </div>{/* end two-column */}

      {/* Configuration output */}
      {summaryLines.length > 0 && (
        <div style={{ borderTop: '1px solid var(--crm-border-light)', padding: '12px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--crm-text-tertiary)', marginBottom: 6 }}>Configuration Output</div>
          <pre style={{ fontSize: 11, fontFamily: 'monospace', background: 'var(--crm-surface-hover)', padding: 10, borderRadius: 6, margin: 0, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify((() => {
            const config: Record<string, unknown> = {};
            if (testProduct) config._product = { id: testProduct.id, title: testProduct.title, basePrice: testProduct.price };
            for (const step of stepTree) {
              for (const group of step.groups) {
                const chosen = selections[group.id];
                if (!chosen || chosen.size === 0) continue;
                Array.from(chosen).forEach(plId => {
                  const pl = group.placements.find(p => p.id === plId);
                  if (!pl) return;
                  const choice = choiceMap.get(str(pl.choiceId));
                  if (!choice) return;
                  const key = str(step.code) + '.' + str(choice.code);
                  const priceStr = formatPlacementPrice(plId, data?.priceRules ?? []);
                  const match = priceStr.match(/\$(\d+(?:\.\d+)?)/);
                  config[key] = { label: str(choice.label), price: match ? parseFloat(match[1]) : 0 };
                });
              }
            }
            config._total = runningTotal;
            // Debug: show what the rule engine sees
            const sel: Record<string, string[]> = {};
            selectionsByGroup.forEach((choiceIds, gId) => {
              const g = (data?.groups ?? []).find(g => g.id === gId);
              const codes = Array.from(choiceIds).map(cid => { const c = choiceMap.get(cid); return c ? str(c.code) : cid.slice(0, 8); });
              sel[g ? str(g.code) : gId.slice(0, 8)] = codes;
            });
            config._selections = sel;
            return config;
          })(), null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
