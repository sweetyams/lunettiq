'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/crm/CrmShell';
import { ActivityTimeline } from '@/components/crm/ActivityTimeline';
import { LogInteractionModal } from '@/components/crm/LogInteractionModal';
import { ProductSearchModal } from '@/components/crm/ProductSearchModal';
import { ConsentToggle } from '@/components/crm/ConsentToggle';
import { TagManager } from '@/components/crm/TagManager';
import { ClientPicker } from '@/components/crm/ClientPicker';
import { FitProfileEditor } from '@/components/crm/FitProfileEditor';
import { PreferencesEditor } from '@/components/crm/PreferencesEditor';
import { ProductSuggestions } from '@/components/crm/ProductSuggestions';
import { CustomFields } from '@/components/crm/CustomFields';
import { MembershipCard } from '@/components/crm/MembershipCard';
import { CreditsLedger } from '@/components/crm/CreditsLedger';
import { CreditAdjustModal } from '@/components/crm/CreditAdjustModal';
import { getTierFromTags } from '@/lib/crm/loyalty-config';

interface Props {
  client: any;
  orders: any[];
  derived: any;
  feedback: any[];
  sessions: any[];
  links: any[];
  stats: { returnRate: number; daysIdle: number | null; avgSpend: number; pairsOwned: number; cadence: number | null; creditBalance: number; orderCount: number };
}

const SH: React.CSSProperties = { fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--crm-text-tertiary)', fontWeight: 500, marginBottom: 'var(--crm-space-3)' };

export function ClientCanvas({ client, orders, derived, feedback, sessions, links, stats }: Props) {
  const { toast } = useToast();
  const meta = (client.metafields ?? {}) as any;
  const custom = meta?.custom ?? {};
  const tier = getTierFromTags(client.tags);

  const [recModalOpen, setRecModalOpen] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [timelineKey, setTimelineKey] = useState(0);
  const [notes, setNotes] = useState(custom.internal_notes ?? '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [quickNote, setQuickNote] = useState('');

  let statedPrefs = {};
  try { statedPrefs = custom.preferences_json ? JSON.parse(custom.preferences_json) : {}; } catch {}
  const fitProfile = { face_shape: custom.face_shape ?? '', frame_width_mm: custom.frame_width_mm ?? '', bridge_width_mm: custom.bridge_width_mm ?? '', temple_length_mm: custom.temple_length_mm ?? '', rx_on_file: custom.rx_on_file ?? '' };
  const customFields: Array<{key: string; value: string}> = (() => { try { return custom.custom_fields ? JSON.parse(custom.custom_fields) : []; } catch { return []; } })();

  const patchClient = useCallback(async (body: any) => {
    await fetch(`/api/crm/clients/${client.shopifyCustomerId}`, { credentials: 'include', method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }, [client.shopifyCustomerId]);

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      {/* ── Hero ── */}
      <Link href="/crm/clients" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>← Clients</Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: 'var(--crm-space-4) 0 var(--crm-space-5)' }}>
        <div>
          {tier && <span style={{ fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 8px', border: '1px solid var(--crm-text-primary)', fontWeight: 600, marginBottom: 6, display: 'inline-block' }}>◆ {tier.toUpperCase()}</span>}
          <h1 style={{ fontSize: 24, fontWeight: 500, margin: '4px 0 0', color: 'var(--crm-text-primary)' }}>{client.firstName} {client.lastName}</h1>
          <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', marginTop: 4, display: 'flex', gap: 10, alignItems: 'center' }}>
            {custom.pronouns && <span>{custom.pronouns}</span>}
            {client.createdAt && <span>Member since {client.createdAt.slice(0, 7)}</span>}
            {custom.home_location && <span>{custom.home_location}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-5)' }}>
          {[
            { label: 'Lifetime', value: `$${client.totalSpent ?? '0'}`, sub: `${stats.orderCount} orders` },
            { label: 'Credits', value: `$${stats.creditBalance}` },
            { label: 'Return rate', value: `${stats.returnRate}%` },
            { label: 'Days idle', value: stats.daysIdle !== null ? String(stats.daysIdle) : '—', sub: stats.daysIdle && stats.daysIdle > 60 ? 'nudge window' : undefined },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'right', paddingLeft: 'var(--crm-space-4)', borderLeft: '1px solid var(--crm-border-light)' }}>
              <div style={{ fontSize: 20, fontWeight: 500 }}>{s.value}</div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase' }}>{s.label}</div>
              {s.sub && <div style={{ fontSize: 'var(--crm-text-xs)', color: stats.daysIdle && stats.daysIdle > 60 && s.label === 'Days idle' ? 'var(--crm-error)' : 'var(--crm-text-tertiary)' }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Mode tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--crm-border-light)', marginBottom: 'var(--crm-space-5)', gap: 0 }}>
        {['Overview', 'Story', 'Fitting room', 'Commercial'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 14px', fontSize: 'var(--crm-text-sm)', background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--crm-text-primary)' : '2px solid transparent',
            color: activeTab === tab ? 'var(--crm-text-primary)' : 'var(--crm-text-tertiary)', fontWeight: activeTab === tab ? 500 : 400, cursor: 'pointer', marginBottom: -1,
          }}>{tab}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => setRecModalOpen(true)} className="crm-btn crm-btn-secondary" style={{ alignSelf: 'center', marginRight: 4, fontSize: 'var(--crm-text-xs)' }}>Recommend</button>
        <button onClick={() => setInteractionOpen(true)} className="crm-btn crm-btn-secondary" style={{ alignSelf: 'center', fontSize: 'var(--crm-text-xs)' }}>+ Note</button>
      </div>

      {/* ── Two column canvas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--crm-space-5)', alignItems: 'start' }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)', minWidth: 0 }}>
          {/* AI Stylist */}
          <AIStyler customerId={client.shopifyCustomerId} />

          {/* Frame deck */}
          <div className="crm-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--crm-space-3) var(--crm-space-4)' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 'var(--crm-text-sm)' }}>Frame history</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{stats.pairsOwned} owned · {feedback.filter((f: any) => f.sentiment === 'love' || f.sentiment === 'like').length} loved · {feedback.filter((f: any) => f.sentiment === 'dislike').length} passed</div>
              </div>
            </div>
            <div style={{ display: 'flex', overflowX: 'auto', borderTop: '1px solid var(--crm-border-light)' }}>
              {/* Owned frames from orders */}
              {orders.flatMap(o => ((o.lineItems as any[]) ?? []).slice(0, 2).map((li: any, i: number) => {
                const fb = feedback.find((f: any) => f.shopifyProductId === li.product_id);
                return (
                  <div key={`${o.shopifyOrderId}-${i}`} style={{ flex: '0 0 140px', padding: 'var(--crm-space-3)', borderRight: '1px solid var(--crm-border-light)', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, background: 'var(--crm-text-primary)', color: 'var(--crm-surface)' }}>●</div>
                    <div style={{ height: 56, background: 'var(--crm-bg)', marginBottom: 8 }} />
                    <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{li.title?.split(' - ')[0] ?? 'Product'}</div>
                    <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{li.variant_title ?? ''} · owned</div>
                  </div>
                );
              }))}
              {/* Feedback-only frames (loved/tried but not purchased) */}
              {feedback.filter((f: any) => !orders.some(o => ((o.lineItems as any[]) ?? []).some((li: any) => li.product_id === f.shopifyProductId))).slice(0, 6).map((f: any) => (
                <div key={f.id} style={{ flex: '0 0 140px', padding: 'var(--crm-space-3)', borderRight: '1px solid var(--crm-border-light)', position: 'relative', opacity: f.sentiment === 'dislike' ? 0.4 : 1 }}>
                  <div style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
                    ...(f.sentiment === 'love' || f.sentiment === 'like' ? { background: 'var(--crm-text-primary)', color: 'var(--crm-surface)' } : { border: '1px solid var(--crm-border)', color: 'var(--crm-text-tertiary)' })
                  }}>{f.sentiment === 'love' ? '♥' : f.sentiment === 'like' ? '♥' : f.sentiment === 'dislike' ? '✕' : '○'}</div>
                  <div style={{ height: 56, background: 'var(--crm-bg)', marginBottom: 8 }} />
                  <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{f.shopifyProductId.slice(0, 12)}</div>
                  <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{f.sentiment} · {f.tryOnCount ?? 0}× tried</div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline with compose bar */}
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--crm-space-2)', alignItems: 'center', marginBottom: 'var(--crm-space-4)', border: '1px solid var(--crm-border-light)', padding: '8px 12px', borderRadius: 'var(--crm-radius-md)' }}>
              <div style={{ width: 22, height: 22, background: 'var(--crm-text-primary)', color: 'var(--crm-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>Y</div>
              <input value={quickNote} onChange={e => setQuickNote(e.target.value)} placeholder="Write a note, log a call…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 'var(--crm-text-sm)', fontFamily: 'inherit', color: 'var(--crm-text-primary)' }}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && quickNote.trim()) {
                    await fetch('/api/crm/interactions', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shopifyCustomerId: client.shopifyCustomerId, type: 'note', body: quickNote, direction: 'internal' }) });
                    setQuickNote(''); setTimelineKey(k => k + 1); toast('Note added');
                  }
                }} />
            </div>
            <ActivityTimeline key={timelineKey} customerId={client.shopifyCustomerId} />
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
          {/* Vitals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--crm-border-light)', borderRadius: 'var(--crm-radius-md)' }}>
            {[
              { l: 'Avg spend', v: `$${stats.avgSpend}` },
              { l: 'Pairs owned', v: String(stats.pairsOwned) },
              { l: 'Cadence', v: stats.cadence !== null ? `${stats.cadence}d` : '—' },
              { l: 'Orders', v: String(stats.orderCount) },
            ].map((s, i) => (
              <div key={s.l} style={{ padding: 'var(--crm-space-3)', borderRight: i % 2 === 0 ? '1px solid var(--crm-border-light)' : 'none', borderBottom: i < 2 ? '1px solid var(--crm-border-light)' : 'none' }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase' }}>{s.l}</div>
                <div style={{ fontSize: 18, fontWeight: 500, marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <h2 style={SH}>Contact</h2>
            <ContactRow label="Email" value={client.email} />
            <ConsentToggle customerId={client.shopifyCustomerId} label="Email" field="accepts_marketing" metafieldKey="marketing_consent_email" enabled={client.acceptsMarketing ?? false} />
            <ContactRow label="Phone" value={client.phone} />
            <ConsentToggle customerId={client.shopifyCustomerId} label="SMS" field="smsConsent" metafieldKey="marketing_consent_sms" enabled={client.smsConsent ?? false} />
            <ContactRow label="Birthday" value={custom.birthday} />
            <ContactRow label="Location" value={custom.home_location} />
          </div>

          {/* Fit */}
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <h2 style={SH}>Fit</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--crm-border-light)' }}>
              {[
                { l: 'Frame width', v: custom.frame_width_mm ? `${custom.frame_width_mm}mm` : '—' },
                { l: 'Bridge', v: custom.bridge_width_mm ? `${custom.bridge_width_mm}mm` : '—' },
                { l: 'Temple', v: custom.temple_length_mm ? `${custom.temple_length_mm}mm` : '—' },
                { l: 'Face shape', v: custom.face_shape || '—' },
              ].map(s => (
                <div key={s.l} style={{ padding: 'var(--crm-space-3)', background: 'var(--crm-surface)', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>{s.v}</div>
                  <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <h2 style={SH}>Tags</h2>
            <TagManager customerId={client.shopifyCustomerId} tags={client.tags ?? []} />
          </div>

          {/* Membership */}
          <MembershipSection customerId={client.shopifyCustomerId} tags={client.tags} />

          {/* Preferences */}
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <h2 style={SH}>Preferences</h2>
            <PreferencesEditor customerId={client.shopifyCustomerId} stated={statedPrefs} derived={derived} />
          </div>

          {/* Suggestions */}
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <h2 style={SH}>Suggested Products</h2>
            <ProductSuggestions customerId={client.shopifyCustomerId} />
          </div>

          {/* Related */}
          <RelatedSection customerId={client.shopifyCustomerId} links={links} />

          {/* Sessions */}
          {sessions.length > 0 && (
            <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
              <h2 style={SH}>Try-on sessions</h2>
              {sessions.map((s: any) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--crm-text-sm)', padding: '4px 0', borderBottom: '1px solid var(--crm-border-light)' }}>
                  <span>{s.startedAt?.slice(0, 10)}</span>
                  <span style={{ color: 'var(--crm-text-tertiary)' }}>{s.outcomeTag ?? 'in progress'}</span>
                </div>
              ))}
            </div>
          )}

          {/* Learned Signals */}
          <LearnedSignals derived={derived} feedback={feedback} orders={orders} />

          {/* Custom Fields */}
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <h2 style={SH}>Custom Fields</h2>
            <CustomFields customerId={client.shopifyCustomerId} fields={customFields} onSave={fields => patchClient({ metafields: { custom_fields: { value: JSON.stringify(fields) } } })} />
          </div>

          {/* Notes */}
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
              <h2 style={{ ...SH, marginBottom: 0 }}>Notes</h2>
              <button onClick={async () => { setNotesSaving(true); await patchClient({ metafields: { internal_notes: { value: notes } } }); setNotesSaving(false); }} className="crm-btn crm-btn-ghost" style={{ fontSize: 'var(--crm-text-xs)' }}>{notesSaving ? 'Saving…' : 'Save'}</button>
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="crm-input" style={{ width: '100%', resize: 'vertical' }} placeholder="Private notes…" />
          </div>
        </div>
      </div>

      <LogInteractionModal customerId={client.shopifyCustomerId} open={interactionOpen} onClose={() => setInteractionOpen(false)} onSaved={() => setTimelineKey(k => k + 1)} />
      <ProductSearchModal open={recModalOpen} onClose={() => setRecModalOpen(false)} onSelect={async (product) => {
        const res = await fetch(`/api/crm/clients/${client.shopifyCustomerId}/recommend`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: product.id, productTitle: product.title }) });
        if (res.ok) { toast(`Recommended ${product.title}`); setTimelineKey(k => k + 1); } else toast('Failed', 'error');
        setRecModalOpen(false);
      }} />
    </div>
  );
}

function ContactRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--crm-text-sm)' }}>
      <span style={{ color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase' }}>{label}</span>
      <span>{value || '—'}</span>
    </div>
  );
}

function MembershipSection({ customerId, tags }: { customerId: string; tags: string[] | null }) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [membership, setMembership] = useState<any>(null);
  const { toast } = useToast();
  const tier = getTierFromTags(tags);

  useEffect(() => {
    fetch(`/api/crm/clients/${customerId}/membership`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setMembership(d.data ?? d)).catch(() => {});
  }, [customerId]);

  if (!tier && !membership) return null;

  return (
    <>
      <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...SH }}>
          <span>Membership</span>
          {membership && <button onClick={() => setAdjustOpen(true)} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>Adjust credits</button>}
        </div>
        {membership ? (
          <MembershipCard tier={membership.tier} status={membership.status} creditBalance={membership.creditBalance} memberSince={membership.memberSince} nextRenewal={membership.nextRenewal} lastLensRefresh={membership.lastLensRefresh} lastRotation={membership.lastRotation} />
        ) : (
          <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>{tier ? 'Loading…' : 'Not a member'}</div>
        )}
      </div>
      {tier && <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}><div style={SH}>Credits</div><CreditsLedger customerId={customerId} onAdjust={() => setAdjustOpen(true)} /></div>}
      {adjustOpen && membership && <CreditAdjustModal customerId={customerId} currentBalance={membership.creditBalance} onClose={() => setAdjustOpen(false)} onAdjusted={() => { fetch(`/api/crm/clients/${customerId}/membership`, { credentials: 'include' }).then(r => r.ok ? r.json() : Promise.reject()).then(d => setMembership(d.data ?? d)).catch(() => {}); }} toast={toast} />}
    </>
  );
}

function RelatedSection({ customerId, links }: { customerId: string; links: any[] }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linkRel, setLinkRel] = useState('family');
  const { toast } = useToast();

  return (
    <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...SH }}>
        <span>Related</span>
        <button onClick={() => setPickerOpen(true)} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>+ Link</button>
      </div>
      {links.length > 0 ? links.map((l: any) => {
        const otherId = l.a === customerId ? l.b : l.a;
        return (
          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--crm-text-sm)', padding: '4px 0' }}>
            <Link href={`/crm/clients/${otherId}`} style={{ fontWeight: 500, color: 'var(--crm-text-primary)' }}>{otherId.slice(0, 12)}</Link>
            <span className="crm-badge" style={{ background: 'var(--crm-surface-hover)', color: 'var(--crm-text-tertiary)' }}>{l.rel}</span>
          </div>
        );
      }) : <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No linked clients</div>}
      <ClientPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={async (c) => {
        setPickerOpen(false);
        const res = await fetch(`/api/crm/clients/${customerId}/link`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ linkedClientId: c.id, relationship: linkRel }) });
        if (res.ok) toast('Linked'); else toast('Failed', 'error');
      }} />
    </div>
  );
}

function AIStyler({ customerId }: { customerId: string }) {
  const [thought, setThought] = useState<string | null>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [askInput, setAskInput] = useState('');
  const { toast } = useToast();

  const fetchInsight = useCallback(async (context?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/clients/${customerId}/ai-styler`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context }) });
      if (res.ok) { const d = await res.json(); const data = d.data ?? d; setThought(data.thought ?? null); setChips(data.chips ?? []); }
      else setThought('AI unavailable right now.');
    } catch { setThought('Could not reach AI.'); }
    setLoading(false);
  }, [customerId]);

  return (
    <div className="crm-card" style={{ padding: 'var(--crm-space-4)', border: '1px solid var(--crm-text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)', paddingBottom: 'var(--crm-space-2)', borderBottom: '1px solid var(--crm-border-light)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--crm-text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span style={{ width: 6, height: 6, background: 'var(--crm-text-primary)', display: 'inline-block' }} />Stylist
        </div>
        <button onClick={() => fetchInsight()} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>refresh</button>
      </div>
      {loading ? (
        <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>Thinking…</div>
      ) : !thought ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 'var(--crm-space-3) 0' }}>
          <button onClick={() => fetchInsight()} className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-sm)' }}>Get AI read on this client</button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 'var(--crm-text-sm)', lineHeight: 1.6, marginBottom: 'var(--crm-space-3)' }}>{thought}</div>
          {chips.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--crm-space-3)' }}>
              {chips.map((c, i) => (
                <button key={i} onClick={() => fetchInsight(c)} style={{ fontSize: 'var(--crm-text-xs)', padding: '5px 10px', background: 'none', border: '1px solid var(--crm-border)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--crm-text-primary)' }}>{c}</button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', border: '1px solid var(--crm-border-light)' }}>
            <input value={askInput} onChange={e => setAskInput(e.target.value)} placeholder="Ask anything about this client…" style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 12px', fontSize: 'var(--crm-text-sm)', fontFamily: 'inherit', background: 'none' }}
              onKeyDown={e => { if (e.key === 'Enter' && askInput.trim()) { fetchInsight(askInput); setAskInput(''); } }} />
            <button onClick={() => { if (askInput.trim()) { fetchInsight(askInput); setAskInput(''); } }} style={{ padding: '8px 14px', background: 'var(--crm-text-primary)', color: 'var(--crm-surface)', border: 'none', cursor: 'pointer', fontSize: 'var(--crm-text-sm)' }}>→</button>
          </div>
        </>
      )}
    </div>
  );
}

function LearnedSignals({ derived, feedback, orders }: { derived: any; feedback: any[]; orders: any[] }) {
  const signals: Array<{ label: string; value: string; pct: number }> = [];

  // Preference patterns from derived data
  if (derived?.derivedShapes) {
    try {
      const shapes = typeof derived.derivedShapes === 'string' ? JSON.parse(derived.derivedShapes) : derived.derivedShapes;
      const top = Object.entries(shapes).sort((a: any, b: any) => b[1] - a[1])[0];
      if (top) signals.push({ label: `Prefers ${top[0]} shapes`, value: 'derived', pct: Math.min(100, Number(top[1]) * 20) });
    } catch {}
  }
  if (derived?.derivedMaterials) {
    try {
      const mats = typeof derived.derivedMaterials === 'string' ? JSON.parse(derived.derivedMaterials) : derived.derivedMaterials;
      const top = Object.entries(mats).sort((a: any, b: any) => b[1] - a[1])[0];
      if (top) signals.push({ label: `Prefers ${top[0]}`, value: 'derived', pct: Math.min(100, Number(top[1]) * 20) });
    } catch {}
  }

  // Behavioral
  const loved = feedback.filter((f: any) => f.sentiment === 'love' || f.sentiment === 'like').length;
  const disliked = feedback.filter((f: any) => f.sentiment === 'dislike').length;
  if (loved + disliked > 0) signals.push({ label: `${loved} frames loved, ${disliked} passed`, value: `${Math.round(loved / (loved + disliked) * 100)}% positive`, pct: Math.round(loved / (loved + disliked) * 100) });

  if (orders.length >= 2) {
    const diffs = orders.slice(0, -1).map((o: any, i: number) => (new Date(o.createdAt).getTime() - new Date(orders[i + 1].createdAt).getTime()) / 86400000);
    const avg = Math.round(diffs.reduce((a: number, b: number) => a + b, 0) / diffs.length);
    signals.push({ label: `Buys every ~${avg} days`, value: 'cadence', pct: Math.min(100, avg > 0 ? Math.round(60 / avg * 100) : 50) });
  }

  if (!signals.length) return null;

  return (
    <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
      <h2 style={SH}>What we've learned</h2>
      {signals.map((s, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: i > 0 ? '1px solid var(--crm-border-light)' : 'none', fontSize: 'var(--crm-text-sm)' }}>
          <div style={{ width: 40, height: 2, background: 'var(--crm-bg)', position: 'relative' }}><div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${s.pct}%`, background: 'var(--crm-text-primary)' }} /></div>
          <div>{s.label}</div>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}
