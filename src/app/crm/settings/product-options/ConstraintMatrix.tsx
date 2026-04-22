'use client';

import { useMemo, useState } from 'react';

interface Entity { id: string; [k: string]: unknown }

interface Props {
  options: Entity[];
  constraintRules: Entity[];
  onSave: () => void;
}

export default function ConstraintMatrix({ options, constraintRules, onSave }: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const activeOptions = options.filter(o => o.active !== false);

  // Build lookup: sourceCode → Set<targetCode>
  const excludes = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of constraintRules) {
      if (r.ruleType !== 'excludes' || r.active === false) continue;
      const src = String(r.sourceOptionCode);
      const targets = (r.targetOptionCodes as string[]) ?? [];
      if (!map.has(src)) map.set(src, new Set());
      for (const t of targets) map.get(src)!.add(t);
    }
    return map;
  }, [constraintRules]);

  // Find constraint rule id for a source→target pair
  function findRule(srcCode: string, tgtCode: string): Entity | undefined {
    return constraintRules.find(r =>
      r.ruleType === 'excludes' && r.sourceOptionCode === srcCode &&
      Array.isArray(r.targetOptionCodes) && (r.targetOptionCodes as string[]).includes(tgtCode)
    );
  }

  function isExcluded(a: string, b: string): boolean {
    return excludes.get(a)?.has(b) || excludes.get(b)?.has(a) || false;
  }

  async function toggle(aCode: string, bCode: string) {
    const key = `${aCode}-${bCode}`;
    setSaving(key);
    try {
      if (isExcluded(aCode, bCode)) {
        // Remove both directions
        for (const r of constraintRules) {
          if (r.ruleType !== 'excludes') continue;
          const src = String(r.sourceOptionCode);
          const targets = (r.targetOptionCodes as string[]) ?? [];
          if ((src === aCode && targets.includes(bCode)) || (src === bCode && targets.includes(aCode))) {
            await fetch('/api/crm/product-options', {
              method: 'DELETE', credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ entity: 'constraint', id: r.id }),
            });
          }
        }
      } else {
        // Create both directions
        for (const [src, tgt] of [[aCode, bCode], [bCode, aCode]]) {
          await fetch('/api/crm/product-options', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entity: 'constraint', code: `mx_${src}_${tgt}`,
              ruleType: 'excludes', sourceOptionCode: src,
              targetOptionCodes: [tgt], active: true,
            }),
          });
        }
      }
      onSave();
    } finally {
      setSaving(null);
    }
  }

  if (activeOptions.length < 2) return null;

  return (
    <div style={{ marginTop: 'var(--crm-space-5)' }}>
      <h3 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, margin: '0 0 var(--crm-space-3)', color: 'var(--crm-text-secondary)' }}>
        Exclusion Matrix
      </h3>
      <div className="crm-card" style={{ overflow: 'auto', padding: 0 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 'var(--crm-text-xs)' }}>
          <thead>
            <tr>
              <th style={{ padding: '6px 10px', borderBottom: '1px solid var(--crm-border)', position: 'sticky', left: 0, background: 'var(--crm-surface)', zIndex: 1 }} />
              {activeOptions.map(o => (
                <th key={o.id} style={{
                  padding: '6px 8px', borderBottom: '1px solid var(--crm-border)',
                  fontWeight: 500, whiteSpace: 'nowrap',
                  writingMode: 'vertical-rl', textOrientation: 'mixed', height: 80,
                }}>
                  {String(o.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeOptions.map((row, ri) => (
              <tr key={row.id}>
                <td style={{
                  padding: '4px 10px', fontWeight: 500, whiteSpace: 'nowrap',
                  borderBottom: '1px solid var(--crm-border-light)',
                  position: 'sticky', left: 0, background: 'var(--crm-surface)', zIndex: 1,
                }}>
                  {String(row.label)}
                </td>
                {activeOptions.map((col, ci) => {
                  const rowCode = String(row.code);
                  const colCode = String(col.code);
                  const isSame = ri === ci;
                  const excluded = !isSame && isExcluded(rowCode, colCode);
                  const isSaving = saving === `${rowCode}-${colCode}` || saving === `${colCode}-${rowCode}`;
                  return (
                    <td
                      key={col.id}
                      onClick={isSame ? undefined : () => toggle(rowCode, colCode)}
                      style={{
                        width: 32, height: 32, textAlign: 'center', verticalAlign: 'middle',
                        borderBottom: '1px solid var(--crm-border-light)',
                        borderRight: '1px solid var(--crm-border-light)',
                        cursor: isSame ? 'default' : 'pointer',
                        background: isSame ? 'var(--crm-surface-hover)' : excluded ? 'var(--crm-error-light)' : 'transparent',
                        opacity: isSaving ? 0.5 : 1,
                        transition: 'background 120ms',
                      }}
                      onMouseEnter={e => { if (!isSame && !excluded) e.currentTarget.style.background = 'var(--crm-surface-hover)'; }}
                      onMouseLeave={e => { if (!isSame && !excluded) e.currentTarget.style.background = ''; }}
                    >
                      {isSame ? '—' : excluded ? '✕' : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 6 }}>
        Click a cell to toggle. <span style={{ color: 'var(--crm-error)' }}>✕</span> = mutually exclusive.
      </div>
    </div>
  );
}
