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
import { getTierFromTags, TIERS, TierKey } from '@/lib/crm/loyalty-config';

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
  const [clientLinks, setClientLinks] = useState(links);
  const [editOpen, setEditOpen] = useState(false);
  const [clientData, setClientData] = useState(client);
  const [suggestionsKey, setSuggestionsKey] = useState(0);

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
          <h1 style={{ fontSize: 24, fontWeight: 500, margin: '4px 0 0', color: 'var(--crm-text-primary)' }}>
            {clientData.firstName} {clientData.lastName}
          </h1>
          <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', marginTop: 4, display: 'flex', gap: 10, alignItems: 'center' }}>
            {custom.pronouns && <span>{custom.pronouns}</span>}
            {client.createdAt && <span>Member since {client.createdAt.slice(0, 7)}</span>}
            {custom.home_location && <span>{custom.home_location}</span>}
            <button onClick={() => setEditOpen(true)} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-accent, #2563eb)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Edit details</button>
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

          {/* Suggested Products — prominent */}
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
              <h2 style={{ ...SH, marginBottom: 0 }}>Suggested for {client.firstName}</h2>
              <button onClick={() => setRecModalOpen(true)} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>+ Add</button>
            </div>
            <ProductSuggestions customerId={client.shopifyCustomerId} refreshKey={suggestionsKey} />
          </div>

          {/* Frame history */}
          <FrameHistory orders={orders} feedback={feedback} pairsOwned={stats.pairsOwned} customerId={client.shopifyCustomerId} clientName={`${clientData.firstName ?? ''} ${clientData.lastName ?? ''}`.trim()} />

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

          {/* Orders */}
          {orders.length > 0 && (
            <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
              <h2 style={SH}>Orders</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2)' }}>
                {orders.map((o: any) => {
                  const items = (o.lineItems as any[]) ?? [];
                  return (
                    <Link key={o.shopifyOrderId} href={`/crm/orders/${o.shopifyOrderId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--crm-bg)', borderRadius: 'var(--crm-radius-md)' }}>
                        <div>
                          <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                            #{o.orderNumber}
                            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 'var(--crm-radius-sm)', background: o.source === 'square' ? '#f3f0ff' : '#f0f7ff', color: o.source === 'square' ? '#6d28d9' : '#2563eb', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{o.source ?? 'shopify'}</span>
                          </div>
                          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
                            {items.length} item{items.length !== 1 ? 's' : ''} · {o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>${o.totalPrice}</div>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 'var(--crm-radius-sm)', background: o.financialStatus === 'paid' ? 'var(--crm-success-light, #dcfce7)' : 'var(--crm-warning-light, #fef9c3)', color: o.financialStatus === 'paid' ? 'var(--crm-success, #16a34a)' : 'var(--crm-warning, #ca8a04)' }}>{o.financialStatus}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', ...SH }}>
              <span>Contact</span>
              <button onClick={() => setEditOpen(true)} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-accent, #2563eb)', background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>
            </div>
            <ContactRow label="Email" value={clientData.email} />
            <ConsentToggle customerId={clientData.shopifyCustomerId} label="Email" field="accepts_marketing" metafieldKey="marketing_consent_email" enabled={clientData.acceptsMarketing ?? false} />
            <ContactRow label="Phone" value={clientData.phone} />
            <ConsentToggle customerId={clientData.shopifyCustomerId} label="SMS" field="smsConsent" metafieldKey="marketing_consent_sms" enabled={clientData.smsConsent ?? false} />
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

          {/* Appointments */}
          <ClientAppointments customerId={client.shopifyCustomerId} />

          {/* Related */}
          <RelatedSection customerId={client.shopifyCustomerId} links={clientLinks} onLinked={l => setClientLinks(prev => [...prev, l])} onRemoved={id => setClientLinks(prev => prev.filter(l => l.id !== id))} />

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
        if (res.ok) { toast(`Recommended ${product.title}`); setTimelineKey(k => k + 1); setSuggestionsKey(k => k + 1); } else toast('Failed', 'error');
        setRecModalOpen(false);
      }} />

      {/* Edit Personal Details Modal */}
      {editOpen && <EditDetailsModal client={clientData} onClose={() => setEditOpen(false)} onSaved={updated => { setClientData(updated); setEditOpen(false); toast('Details updated & synced to Shopify'); }} />}
    </div>
  );
}

function ClientAppointments({ customerId }: { customerId: string }) {
  const [appts, setAppts] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [booking, setBooking] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [apptTypes, setApptTypes] = useState<{ name: string; durationMinutes: number }[]>([]);
  const { toast } = useToast();

  const load = useCallback(() => {
    fetch(`/api/crm/clients/${customerId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setAppts((d.data?.appointments ?? []).sort((a: any, b: any) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [customerId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/crm/appointment-types', { credentials: 'include' }).then(r => r.json()).then(d => setApptTypes(d.data ?? [])).catch(() => {});
  }, []);

  async function changeStatus(id: string, status: string) {
    const res = await fetch(`/api/crm/appointments/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) { toast(`Marked ${status}`); setAppts(prev => prev.map(a => a.id === id ? { ...a, status } : a)); }
    else toast('Failed', 'error');
  }

  async function handleBook() {
    if (!title || !date || !time) return;
    setSaving(true);
    const dur = apptTypes.find(t => t.name === title)?.durationMinutes ?? 30;
    const startsAt = new Date(`${date}T${time}`);
    const endsAt = new Date(startsAt.getTime() + dur * 60000);
    const res = await fetch('/api/crm/appointments', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, customerId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }) });
    if (res.ok) { toast('Booked'); setBooking(false); setTitle(''); setDate(''); setTime(''); load(); }
    else { const e = await res.json().catch(() => ({})); toast(e.error || 'Failed', 'error'); }
    setSaving(false);
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const upcoming = appts.filter(a => new Date(a.startsAt) >= new Date() && a.status !== 'cancelled');
  const past = appts.filter(a => new Date(a.startsAt) < new Date() || a.status === 'cancelled');

  return (
    <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...SH }}>
        <span>Appointments</span>
        <button onClick={() => setBooking(!booking)} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>{booking ? 'Cancel' : '+ Book'}</button>
      </div>
      {booking && (
        <div style={{ marginBottom: 'var(--crm-space-3)', padding: 'var(--crm-space-3)', border: '1px solid var(--crm-border-light)', borderRadius: 'var(--crm-radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2)' }}>
          <select value={title} onChange={e => setTitle(e.target.value)} className="crm-input" style={{ width: '100%', fontSize: 'var(--crm-text-xs)' }}>
            <option value="">Type…</option>
            {apptTypes.map(t => <option key={t.name} value={t.name}>{t.name} ({t.durationMinutes}m)</option>)}
          </select>
          <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="crm-input" style={{ flex: 1, fontSize: 'var(--crm-text-xs)' }} />
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="crm-input" style={{ width: 90, fontSize: 'var(--crm-text-xs)' }} />
          </div>
          <button onClick={handleBook} disabled={saving || !title || !date || !time} className="crm-btn crm-btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 'var(--crm-text-xs)' }}>
            {saving ? 'Booking…' : 'Book'}
          </button>
        </div>
      )}
      {!loaded ? <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>Loading…</div> : (
        <>
          {upcoming.map(a => (
            <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--crm-border-light)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{a.title}</div>
                  <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{fmtDate(a.startsAt)} · {fmtTime(a.startsAt)}</div>
                </div>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--crm-radius-sm)', background: 'var(--crm-surface-hover)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase' }}>{a.status}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {a.status === 'scheduled' && <>
                  <button onClick={() => changeStatus(a.id, 'confirmed')} style={{ fontSize: 10, padding: '2px 8px', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius-sm)', background: 'var(--crm-surface)', cursor: 'pointer' }}>Confirm</button>
                  <button onClick={() => changeStatus(a.id, 'cancelled')} style={{ fontSize: 10, padding: '2px 8px', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius-sm)', background: 'var(--crm-surface)', cursor: 'pointer', color: 'var(--crm-text-tertiary)' }}>Cancel</button>
                </>}
                {a.status === 'confirmed' && <>
                  <button onClick={() => changeStatus(a.id, 'completed')} style={{ fontSize: 10, padding: '2px 8px', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius-sm)', background: 'var(--crm-surface)', cursor: 'pointer' }}>Complete</button>
                  <button onClick={() => changeStatus(a.id, 'no_show')} style={{ fontSize: 10, padding: '2px 8px', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius-sm)', background: 'var(--crm-surface)', cursor: 'pointer', color: 'var(--crm-text-tertiary)' }}>No show</button>
                </>}
              </div>
            </div>
          ))}
          {past.length > 0 && (
            <details style={{ marginTop: 'var(--crm-space-2)' }}>
              <summary style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', cursor: 'pointer' }}>Past ({past.length})</summary>
              {past.map(a => (
                <div key={a.id} style={{ padding: '4px 0', fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{a.title} · {fmtDate(a.startsAt)}</span>
                  <span>{a.status}</span>
                </div>
              ))}
            </details>
          )}
          {!appts.length && <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No appointments</div>}
        </>
      )}
    </div>
  );
}

const FRAME_TABS = ['All', 'Owned', 'Loved', 'Passed'] as const;
const BADGE: Record<string, { label: string; bg: string; color: string; border?: string }> = {
  owned: { label: 'Owned', bg: 'var(--crm-text-primary)', color: 'var(--crm-surface)' },
  love: { label: '♥ Love', bg: 'var(--crm-text-primary)', color: 'var(--crm-surface)' },
  like: { label: '♥ Like', bg: 'var(--crm-text-primary)', color: 'var(--crm-surface)' },
  dislike: { label: '✕ Pass', bg: 'var(--crm-surface)', color: 'var(--crm-text-tertiary)', border: '1px solid var(--crm-border)' },
  neutral: { label: 'Tried', bg: 'var(--crm-surface)', color: 'var(--crm-text-tertiary)', border: '1px solid var(--crm-border)' },
};

function FrameHistory({ orders, feedback, pairsOwned, customerId, clientName }: { orders: any[]; feedback: any[]; pairsOwned: number; customerId: string; clientName: string }) {
  const [tab, setTab] = useState<typeof FRAME_TABS[number]>('All');
  const [feedbackState, setFeedbackState] = useState<Record<string, string>>({});
  const { toast } = useToast();

  function recordFeedback(productId: string | null, sentiment: 'like' | 'dislike') {
    if (!productId) return;
    setFeedbackState(prev => ({ ...prev, [productId]: sentiment }));
    fetch(`/api/crm/clients/${customerId}/suggestions/dismiss`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, sentiment }),
    });
  }

  // Build unified list
  const owned = orders.flatMap(o => ((o.lineItems as any[]) ?? []).map((li: any, i: number) => {
    const displayName = li.productTitle ?? li.name?.split(' - ')[0]?.trim() ?? 'Product';
    const [frameName, variant] = displayName.includes('©') ? displayName.split('©').map((s: string) => s.trim()) : [displayName, ''];
    const isRelated = li.mappingStatus === 'related';
    return { key: `${o.shopifyOrderId}-${i}`, type: 'owned' as const, frameName, variant, imageUrl: li.imageUrl, productId: null, sub: `${o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : ''}${li.price ? ' · $' + li.price : ''}${isRelated ? ' · related' : ''}` };
  }));

  // Collect owned frame names for dedup — format as "MARAIS © GREEN" to match productTitle
  const ownedNames = new Set(owned.map(o => {
    const full = o.variant ? `${o.frameName} © ${o.variant}` : o.frameName;
    return full.toUpperCase().trim();
  }));

  const feedbackItems = feedback
    .filter((f: any) => {
      const title = (f.productTitle ?? '').toUpperCase().trim();
      return !title || !ownedNames.has(title);
    })
    .map((f: any) => {
      const title = f.productTitle ?? '';
      const [frameName, variant] = title.includes('©') ? title.split('©').map((s: string) => s.trim()) : [title || 'Unknown', ''];
      // Use dynamic feedback state if available, otherwise use DB value
      const currentSentiment = feedbackState[f.shopifyProductId] ?? f.sentiment ?? 'neutral';
      return { key: f.id || f.shopifyProductId, type: currentSentiment as string, frameName, variant, imageUrl: f.imageUrl, productId: f.shopifyProductId, sub: `${f.tryOnCount ?? 0}× tried` };
    });

  const all = [...owned, ...feedbackItems];
  const lovedItems = feedbackItems.filter(f => f.type === 'love' || f.type === 'like');
  const passedItems = feedbackItems.filter(f => f.type === 'dislike');

  // "All" shows owned + loved (hides passed)
  const filtered = tab === 'All' ? [...owned, ...lovedItems]
    : tab === 'Owned' ? owned
    : tab === 'Loved' ? lovedItems
    : passedItems;

  const counts: Record<string, number> = { All: owned.length + lovedItems.length, Owned: owned.length, Loved: lovedItems.length, Passed: passedItems.length };

  return (
    <div className="crm-card" style={{ padding: 'var(--crm-space-4)', minHeight: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
        <div style={{ fontWeight: 500, fontSize: 'var(--crm-text-sm)' }}>Frame history</div>
      </div>
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--crm-border-light)', marginBottom: 'var(--crm-space-3)' }}>
        {FRAME_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 12px', fontSize: 'var(--crm-text-xs)', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid var(--crm-text-primary)' : '2px solid transparent',
            color: tab === t ? 'var(--crm-text-primary)' : 'var(--crm-text-tertiary)',
            fontWeight: tab === t ? 600 : 400, cursor: 'pointer', marginBottom: -1,
          }}>{t} <span style={{ opacity: 0.5 }}>{counts[t]}</span></button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--crm-space-4)', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>
          {all.length === 0 ? 'No frame history yet' : `No ${tab.toLowerCase()} frames`}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--crm-space-3)' }}>
          {filtered.map(f => {
            const b = BADGE[f.type] ?? BADGE.neutral;
            const card = (
              <div style={{ background: 'var(--crm-bg)', borderRadius: 'var(--crm-radius-md)', overflow: 'hidden', position: 'relative', opacity: f.type === 'dislike' ? 0.5 : 1 }}>
                <div style={{ position: 'absolute', top: 6, left: 6, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 8px', borderRadius: 20, zIndex: 1, background: b.bg, color: b.color, border: b.border ?? 'none' }}>{b.label}</div>
                {f.productId && f.type !== 'owned' && (
                  <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 10, display: 'flex', gap: 3 }}>
                    <div role="button" tabIndex={0} onClick={(e) => { e.preventDefault(); e.stopPropagation(); recordFeedback(f.productId, 'like'); }}
                      style={{ width: 22, height: 22, borderRadius: '50%', background: f.type === 'like' || f.type === 'love' ? 'var(--crm-text-primary)' : 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>♥</div>
                    <div role="button" tabIndex={0} onClick={(e) => { e.preventDefault(); e.stopPropagation(); recordFeedback(f.productId, 'dislike'); }}
                      style={{ width: 22, height: 22, borderRadius: '50%', background: f.type === 'dislike' ? 'var(--crm-text-tertiary)' : 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</div>
                  </div>
                )}
                <div style={{ aspectRatio: '1', background: 'var(--crm-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {f.imageUrl
                    ? <img src={f.imageUrl} alt={f.frameName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 28 }}>👓</span>}
                </div>
                <div style={{ padding: '8px 10px 10px' }}>
                  <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.frameName}</div>
                  {f.variant && <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)' }}>{f.variant}</div>}
                  <div style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', marginTop: 2 }}>{f.sub}</div>
                </div>
              </div>
            );
            return f.productId
              ? <Link key={f.key} href={`/crm/products/${f.productId}?client=${encodeURIComponent(customerId)}&clientName=${encodeURIComponent(clientName)}`} style={{ textDecoration: 'none', color: 'inherit' }}>{card}</Link>
              : <div key={f.key}>{card}</div>;
          })}
        </div>
      )}
    </div>
  );
}

function EditDetailsModal({ client, onClose, onSaved }: { client: any; onClose: () => void; onSaved: (updated: any) => void }) {
  const [form, setForm] = useState({ firstName: client.firstName ?? '', lastName: client.lastName ?? '', email: client.email ?? '', phone: client.phone ?? '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/crm/clients/${client.shopifyCustomerId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const d = await res.json();
      onSaved(d.data ?? { ...client, ...form });
    }
    setSaving(false);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 420, background: 'var(--crm-surface)', borderRadius: 'var(--crm-radius-xl)', boxShadow: 'var(--crm-shadow-overlay)', padding: 'var(--crm-space-6)', zIndex: 51 }}>
        <h3 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, marginBottom: 'var(--crm-space-4)' }}>Edit Details</h3>
        <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-4)' }}>Changes sync to Shopify automatically.</div>
        {[
          { key: 'firstName', label: 'First name' },
          { key: 'lastName', label: 'Last name' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'phone', label: 'Phone', type: 'tel' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 'var(--crm-space-3)' }}>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{f.label}</div>
            <input value={(form as any)[f.key]} onChange={e => set(f.key, e.target.value)} type={f.type ?? 'text'} className="crm-input" style={{ width: '100%' }} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)', justifyContent: 'flex-end', marginTop: 'var(--crm-space-4)' }}>
          <button onClick={onClose} className="crm-btn crm-btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="crm-btn crm-btn-primary">{saving ? 'Saving…' : 'Save & Sync'}</button>
        </div>
      </div>
    </>
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

function CreditCodesPanel({ customerId, onRevoke }: { customerId: string; onRevoke: () => void }) {
  const [codes, setCodes] = useState<any[]>([]);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/crm/clients/${customerId}/loyalty`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.resolve({ data: { codes: [] } }))
      .then(d => setCodes(d.data?.codes ?? []))
      .catch(() => {});
  }, [customerId]);

  async function revoke(codeId: string) {
    if (!confirm('Revoke this code? Balance will be returned to customer.')) return;
    setRevoking(codeId);
    const res = await fetch(`/api/crm/clients/${customerId}/credits/revoke`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeId }),
    });
    if (res.ok) { setCodes(prev => prev.map(c => c.id === codeId ? { ...c, status: 'revoked' } : c)); onRevoke(); }
    setRevoking(null);
  }

  if (!codes.length) return null;

  return (
    <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', marginBottom: 'var(--crm-space-2)' }}>Credit Codes</div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {codes.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--crm-border-light)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 'var(--crm-text-xs)', fontFamily: 'monospace', fontWeight: 600 }}>{c.fullCode ?? c.code}</span>
                <span className="crm-badge" style={{ fontSize: 9, background: c.status === 'active' ? '#dcfce7' : c.status === 'revoked' ? '#fee2e2' : '#f3f4f6', color: c.status === 'active' ? '#166534' : c.status === 'revoked' ? '#991b1b' : '#6b7280' }}>{c.status}</span>
                <span className="crm-badge" style={{ fontSize: 9, background: c.method === 'gift_card' ? '#e0f2fe' : '#fef3c7', color: c.method === 'gift_card' ? '#0369a1' : '#92400e' }}>{c.method === 'gift_card' ? 'online' : 'in-store'}</span>
              </div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>
                ${Number(c.amount).toFixed(2)} · {new Date(c.createdAt).toLocaleDateString('en-CA')}
              </div>
            </div>
            {c.status === 'active' && (
              <button onClick={() => revoke(c.id)} disabled={revoking === c.id}
                style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-error, #dc2626)', background: 'none', border: 'none', cursor: 'pointer', opacity: revoking === c.id ? 0.5 : 1 }}>
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MembershipSection({ customerId, tags }: { customerId: string; tags: string[] | null }) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [membership, setMembership] = useState<any>(null);
  const [changing, setChanging] = useState(false);
  const [points, setPoints] = useState<{ balance: number; history: any[] } | null>(null);
  const { toast } = useToast();
  const tier = getTierFromTags(tags);

  const reload = () => {
    fetch(`/api/crm/clients/${customerId}/membership`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setMembership(d.data ?? d)).catch(() => {});
    fetch(`/api/crm/clients/${customerId}/points`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject()).then(d => setPoints(d.data ?? d)).catch(() => {});
  };

  useEffect(() => { reload(); }, [customerId]);

  async function changeTier(newTier: string | null) {
    setChanging(true);
    const res = await fetch(`/api/crm/clients/${customerId}/membership`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: newTier }) });
    if (res.ok) { toast(newTier ? `Upgraded to ${newTier}` : 'Membership removed'); reload(); }
    else toast('Failed', 'error');
    setChanging(false);
  }

  async function changeStatus(status: string) {
    const res = await fetch(`/api/crm/clients/${customerId}/membership`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) { toast(`Status: ${status}`); reload(); }
    else toast('Failed', 'error');
  }

  const TIER_KEYS = Object.keys(TIERS) as TierKey[];

  return (
    <>
      {/* Points */}
      <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...SH }}>
          <span>Points</span>
        </div>
        {points ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600 }}>{points.balance.toLocaleString()}</div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>≈ ${Math.floor(points.balance / 100) * 5}</div>
            </div>
            {points.history.length > 0 && (
              <div style={{ marginTop: 'var(--crm-space-2)', maxHeight: 100, overflowY: 'auto' }}>
                {points.history.slice(0, 5).map((h: any) => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--crm-text-xs)', padding: '2px 0' }}>
                    <span style={{ color: 'var(--crm-text-tertiary)' }}>{h.reason?.slice(0, 30)}</span>
                    <span style={{ color: Number(h.amount) >= 0 ? 'var(--crm-success, #16a34a)' : 'var(--crm-error, #dc2626)' }}>{Number(h.amount) >= 0 ? '+' : ''}{h.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>Loading…</div>
        )}
      </div>

      <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...SH }}>
          <span>Membership</span>
          <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
            {membership && <button onClick={() => setAdjustOpen(true)} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>Adjust credits</button>}
          </div>
        </div>

        {membership?.tier ? (
          <>
            <MembershipCard tier={membership.tier} status={membership.status} creditBalance={membership.creditBalance} memberSince={membership.memberSince} nextRenewal={membership.nextRenewal} lastLensRefresh={membership.lastLensRefresh} lastRotation={membership.lastRotation} customerId={customerId} onTierChange={reload} />

            {/* Tier change */}
            <div style={{ marginTop: 'var(--crm-space-3)', paddingTop: 'var(--crm-space-3)', borderTop: '1px solid var(--crm-border-light)' }}>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-2)' }}>Change tier</div>
              <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
                {TIER_KEYS.map(t => (
                  <button key={t} onClick={() => changeTier(t)} disabled={changing || membership.tier === t}
                    style={{ flex: 1, padding: '4px 0', fontSize: 'var(--crm-text-xs)', border: `1px solid ${membership.tier === t ? 'var(--crm-text-primary)' : 'var(--crm-border)'}`, borderRadius: 'var(--crm-radius-sm)', background: membership.tier === t ? 'var(--crm-text-primary)' : 'var(--crm-surface)', color: membership.tier === t ? 'var(--crm-surface)' : 'var(--crm-text-secondary)', cursor: 'pointer' }}>
                    {TIERS[t].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status controls */}
            <div style={{ marginTop: 'var(--crm-space-2)', display: 'flex', gap: 'var(--crm-space-2)' }}>
              {membership.status !== 'paused' && <button onClick={() => changeStatus('paused')} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-warning, #ca8a04)', background: 'none', border: 'none', cursor: 'pointer' }}>Pause</button>}
              {membership.status === 'paused' && <button onClick={() => changeStatus('active')} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-success, #16a34a)', background: 'none', border: 'none', cursor: 'pointer' }}>Reactivate</button>}
              {membership.status !== 'cancelled' && <button onClick={() => { if (confirm('Cancel membership? 60-day grace period applies.')) changeStatus('cancelled'); }} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-error, #dc2626)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>}
            </div>
          </>
        ) : (
          /* Enrollment */
          <div>
            <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-3)' }}>Not a member</div>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-2)' }}>Enroll in a tier</div>
            <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
              {TIER_KEYS.map(t => (
                <button key={t} onClick={() => changeTier(t)} disabled={changing}
                  style={{ flex: 1, padding: '8px 0', fontSize: 'var(--crm-text-xs)', fontWeight: 500, border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius-sm)', background: 'var(--crm-surface)', cursor: 'pointer', color: 'var(--crm-text-primary)' }}>
                  {TIERS[t].label}<br /><span style={{ fontWeight: 400, color: 'var(--crm-text-tertiary)' }}>${TIERS[t].monthlyCredit}/mo</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {membership?.tier && <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}><div style={SH}>Credits</div><CreditsLedger customerId={customerId} onAdjust={() => setAdjustOpen(true)} /></div>}
      {membership?.tier && <CreditCodesPanel customerId={customerId} onRevoke={reload} />}
      {adjustOpen && membership && <CreditAdjustModal customerId={customerId} currentBalance={membership.creditBalance} onClose={() => setAdjustOpen(false)} onAdjusted={reload} toast={toast} />}
    </>
  );
}

function RelatedSection({ customerId, links, onLinked, onRemoved }: { customerId: string; links: any[]; onLinked: (link: any) => void; onRemoved: (id: string) => void }) {
  const [step, setStep] = useState<'idle' | 'pick-rel' | 'pick-client'>('idle');
  const [linkRel, setLinkRel] = useState('family');
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();
  const RELS = ['family', 'spouse', 'parent', 'child', 'friend', 'colleague', 'referral'];

  return (
    <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...SH }}>
        <span>Related</span>
        <button onClick={() => setStep('pick-rel')} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>+ Link</button>
      </div>
      {links.length > 0 ? links.map((l: any) => {
        const otherId = l.a === customerId ? l.b : l.a;
        return (
          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--crm-text-sm)', padding: '4px 0' }}>
            <Link href={`/crm/clients/${otherId}`} style={{ fontWeight: 500, color: 'var(--crm-text-primary)' }}>{l.otherName || `Client #${otherId.slice(-6)}`}</Link>
            {editingId === l.id ? (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {RELS.map(r => (
                  <button key={r} onClick={async () => {
                    l.rel = r; setEditingId(null);
                    await fetch(`/api/crm/clients/${customerId}/link`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ linkId: l.id, relationship: r }) });
                    toast('Updated');
                  }} style={{ padding: '2px 8px', fontSize: 10, borderRadius: 'var(--crm-radius-sm)', cursor: 'pointer', border: `1px solid ${l.rel === r ? 'var(--crm-accent)' : 'var(--crm-border)'}`, background: l.rel === r ? 'var(--crm-accent-light)' : 'var(--crm-surface)', color: l.rel === r ? 'var(--crm-accent)' : 'var(--crm-text-tertiary)' }}>{r}</button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button onClick={() => setEditingId(l.id)} style={{ background: 'var(--crm-surface-hover)', color: 'var(--crm-text-tertiary)', border: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: 'var(--crm-radius-sm)', fontSize: 'var(--crm-text-xs)' }}>{l.rel}</button>
                <button onClick={async () => {
                  onRemoved(l.id);
                  await fetch(`/api/crm/clients/${customerId}/link`, { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ linkId: l.id }) });
                  toast('Removed');
                }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--crm-text-tertiary)', padding: '0 2px' }} title="Remove">×</button>
              </div>
            )}
          </div>
        );
      }) : <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No linked clients</div>}
      {step === 'pick-rel' && (
        <div style={{ marginTop: 'var(--crm-space-3)', padding: 'var(--crm-space-3)', border: '1px solid var(--crm-border-light)', borderRadius: 'var(--crm-radius-md)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 6 }}>What's the relationship?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {RELS.map(r => (
              <button key={r} onClick={() => { setLinkRel(r); setStep('pick-client'); }} style={{ padding: '4px 12px', fontSize: 'var(--crm-text-xs)', borderRadius: 'var(--crm-radius-md)', border: '1px solid var(--crm-border)', background: 'var(--crm-surface)', color: 'var(--crm-text-secondary)', cursor: 'pointer' }}>{r}</button>
            ))}
          </div>
          <button onClick={() => setStep('idle')} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 8 }}>Cancel</button>
        </div>
      )}
      <ClientPicker open={step === 'pick-client'} onClose={() => setStep('idle')} onSelect={async (c) => {
        setStep('idle');
        const res = await fetch(`/api/crm/clients/${customerId}/link`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ linkedClientId: c.id, relationship: linkRel }) });
        if (res.ok) { const d = await res.json(); onLinked({ id: d.data?.id ?? Date.now(), a: customerId, b: c.id, rel: linkRel, otherName: c.name }); toast(`Linked as ${linkRel}`); }
        else toast('Failed', 'error');
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
