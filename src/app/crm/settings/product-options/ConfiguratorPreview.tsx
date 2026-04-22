'use client';

import { useMemo } from 'react';

interface Entity { id: string; [k: string]: unknown }

interface Props {
  channel: string;
  steps: Entity[];
  groups: Entity[];
  options: Entity[];
  priceRules: Entity[];
  constraintRules: Entity[];
  onEditStep?: (step: Entity) => void;
  onEditOption?: (option: Entity) => void;
}

export default function ConfiguratorPreview({
  channel, steps, groups, options, priceRules, constraintRules,
  onEditStep, onEditOption,
}: Props) {
  const tree = useMemo(() => {
    const channelSteps = steps
      .filter(s => s.channel === channel && s.active !== false)
      .sort((a, b) => num(a.sortOrder) - num(b.sortOrder));

    return channelSteps.map(step => {
      const groupCodes = (step.optionGroupCodes as string[]) ?? [];
      const stepGroups = groupCodes
        .map(code => groups.find(g => g.code === code))
        .filter((g): g is Entity => !!g && g.active !== false);

      const enrichedGroups = stepGroups.map(group => {
        const groupOptions = options
          .filter(o => o.groupId === group.id && o.active !== false && hasChannel(o.channels, channel))
          .sort((a, b) => num(a.sortOrder) - num(b.sortOrder));

        const enrichedOptions = groupOptions.map(opt => {
          const prices = priceRules.filter(
            p => p.active !== false && hasChannel(p.channels, channel) &&
              Array.isArray(p.optionCodes) && (p.optionCodes as string[]).includes(opt.code as string)
          );
          const constraints = constraintRules.filter(
            c => c.active !== false && c.sourceOptionCode === opt.code
          );
          return { ...opt, prices, constraints };
        });

        return { ...group, options: enrichedOptions };
      });

      return { ...step, groups: enrichedGroups };
    });
  }, [channel, steps, groups, options, priceRules, constraintRules]);

  if (tree.length === 0) {
    return (
      <div className="crm-card" style={{ padding: 'var(--crm-space-12)', textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>
        No steps defined for {channel}. Add steps in the Advanced tab.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      {tree.map((step, si) => (
        <div key={step.id} className="crm-card" style={{ overflow: 'hidden' }}>
          {/* Step header */}
          <div
            onClick={() => onEditStep?.(step)}
            style={{
              padding: '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--crm-surface-hover)',
              cursor: onEditStep ? 'pointer' : 'default',
              borderBottom: '1px solid var(--crm-border-light)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)' }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'var(--crm-text-primary)', color: 'var(--crm-text-inverse)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--crm-text-xs)', fontWeight: 600,
              }}>
                {si + 1}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--crm-text-sm)' }}>{str(step.label)}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
                  {(step.groups as { options: unknown[] }[]).reduce((n, g) => n + g.options.length, 0)} options
                  {' · '}{str(step.code)}
                </div>
              </div>
            </div>
            {onEditStep && (
              <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>Edit ›</span>
            )}
          </div>

          {/* Groups + Options */}
          <div style={{ padding: '0' }}>
            {(step.groups as EnrichedGroup[]).map(group => (
              <div key={group.id}>
                {(step.groups as unknown[]).length > 1 && (
                  <div style={{
                    padding: '6px 16px', fontSize: 'var(--crm-text-xs)', fontWeight: 500,
                    color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--crm-border-light)',
                  }}>
                    {str(group.label)} · {str(group.selectionMode)}
                  </div>
                )}
                {group.options.map(opt => (
                  <div
                    key={opt.id}
                    onClick={() => onEditOption?.(opt)}
                    style={{
                      padding: '10px 16px 10px 48px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderBottom: '1px solid var(--crm-border-light)',
                      cursor: onEditOption ? 'pointer' : 'default',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--crm-surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <div>
                      <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{str(opt.label)}</div>
                      {opt.constraints.length > 0 && (
                        <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-warning)', marginTop: 2 }}>
                          {opt.constraints.map((c: Entity) =>
                            `${str(c.ruleType)} → ${arr(c.targetOptionCodes)}`
                          ).join(' · ')}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)' }}>
                      {opt.prices.length > 0 ? (
                        opt.prices.map((p: Entity) => (
                          <span key={p.id} className="crm-badge" style={{
                            background: str(p.pricingType) === 'absolute'
                              ? 'var(--crm-surface-hover)' : num(p.amountCad) > 0
                              ? 'var(--crm-success-light)' : 'var(--crm-surface-hover)',
                            color: str(p.pricingType) === 'absolute'
                              ? 'var(--crm-text-secondary)' : num(p.amountCad) > 0
                              ? 'var(--crm-success)' : 'var(--crm-text-tertiary)',
                          }}>
                            {str(p.pricingType) === 'absolute' ? `$${str(p.amountCad)}` : `+$${str(p.amountCad)}`}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>included</span>
                      )}
                      {onEditOption && (
                        <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>›</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type EnrichedGroup = Entity & { options: (Entity & { prices: Entity[]; constraints: Entity[] })[] };

function str(v: unknown) { return String(v ?? ''); }
function num(v: unknown) { return Number(v ?? 0); }
function arr(v: unknown) { return Array.isArray(v) ? v.join(', ') : str(v); }
function hasChannel(channels: unknown, ch: string) {
  return !Array.isArray(channels) || channels.includes(ch);
}
