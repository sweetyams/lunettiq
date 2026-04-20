'use client';

import { useState, useEffect } from 'react';

interface Tier {
  id: string; label: string; tag: string; monthlyCredit: string; birthdayCredit: string;
  tradeInRate: string; lensRefresh: boolean; frameRotation: string | null; sortOrder: number; active: boolean;
  monthlyFee: string | null; annualFee: string | null; secondSightRate: string | null;
  earlyAccessHours: number; namedOptician: boolean; freeRepairs: string | null;
  styleConsultation: string | null; eventsPerYear: number; annualGift: boolean;
  archiveVote: boolean; privateWhatsapp: boolean;
  shippingTier: string | null;
  referralRewardCredit: string | null; referralExtensionMonths: number;
  referredDiscount: string | null; referredTrialTier: string | null;
}

const EMPTY: Tier = { id: '', label: '', tag: '', monthlyCredit: '0', birthdayCredit: '20', tradeInRate: '0', lensRefresh: false, frameRotation: null, sortOrder: 0, active: true, monthlyFee: null, annualFee: null, secondSightRate: null, earlyAccessHours: 0, namedOptician: false, freeRepairs: null, styleConsultation: null, eventsPerYear: 0, annualGift: false, archiveVote: false, privateWhatsapp: false, shippingTier: null, referralRewardCredit: null, referralExtensionMonths: 0, referredDiscount: null, referredTrialTier: null };

export default function LoyaltySettingsPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [editing, setEditing] = useState<Tier | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => fetch('/api/crm/settings/loyalty', { credentials: 'include' }).then(r => r.json()).then(d => setTiers(d.data ?? []));
  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    await fetch('/api/crm/settings/loyalty', { method: isNew ? 'POST' : 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    setSaving(false); setEditing(null); load();
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-6">Loyalty Tiers</h1>

      <div className="space-y-3 mb-6">
        {tiers.map(t => (
          <div key={t.id} className={`border rounded-lg p-4 bg-white ${t.active ? 'border-neutral-200' : 'border-neutral-100 opacity-50'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-semibold text-lg">{t.label}</span>
                <span className="text-xs text-neutral-400 ml-2">({t.id})</span>
                {!t.active && <span className="text-xs text-red-400 ml-2">Inactive</span>}
              </div>
              <button onClick={() => { setEditing({ ...t }); setIsNew(false); }} className="text-xs text-neutral-400 hover:text-neutral-700">Edit</button>
            </div>
            <div className="grid grid-cols-5 gap-3 text-sm mb-2">
              <div><span className="text-xs text-neutral-400 block">Monthly fee</span>${t.monthlyFee ?? '—'}/mo</div>
              <div><span className="text-xs text-neutral-400 block">Annual fee</span>${t.annualFee ?? '—'}/yr</div>
              <div><span className="text-xs text-neutral-400 block">Monthly credit</span>${t.monthlyCredit}</div>
              <div><span className="text-xs text-neutral-400 block">Birthday credit</span>${t.birthdayCredit}</div>
              <div><span className="text-xs text-neutral-400 block">Trade-in</span>{(Number(t.secondSightRate ?? t.tradeInRate) * 100).toFixed(0)}%</div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
              {t.shippingTier && <span>📦 {t.shippingTier} shipping</span>}
              {t.earlyAccessHours > 0 && <span>⏰ {t.earlyAccessHours}h early access</span>}
              {t.namedOptician && <span>👤 Named optician</span>}
              {t.freeRepairs && <span>🔧 Repairs: {t.freeRepairs}</span>}
              {t.styleConsultation && <span>💬 Consult: {t.styleConsultation}</span>}
              {t.lensRefresh && <span>🔄 Lens refresh</span>}
              {t.frameRotation && <span>🔁 Rotation: {t.frameRotation}</span>}
              {t.eventsPerYear > 0 && <span>🎉 {t.eventsPerYear} events/yr</span>}
              {t.annualGift && <span>🎁 Annual gift</span>}
              {t.archiveVote && <span>🗳️ Archive vote</span>}
              {t.privateWhatsapp && <span>📱 WhatsApp</span>}
              {t.referralRewardCredit && <span>🔗 Referral: ${t.referralRewardCredit} credit</span>}
              {t.referredDiscount && <span>🎟️ Referred: ${t.referredDiscount} off</span>}
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => { setEditing({ ...EMPTY, sortOrder: tiers.length }); setIsNew(true); }} className="px-4 py-2 text-sm border border-dashed border-neutral-300 rounded-lg w-full hover:border-neutral-400">+ Add Tier</button>

      {editing && (
        <>
          <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
          <div style={{ position: 'fixed', top: '5%', left: '50%', transform: 'translateX(-50%)', width: 600, maxHeight: '90vh', overflowY: 'auto', background: 'white', borderRadius: 12, padding: 24, zIndex: 51 }}>
            <h2 className="text-lg font-semibold mb-4">{isNew ? 'New Tier' : `Edit ${editing.label}`}</h2>

            <Section title="Identity">
              <div className="grid grid-cols-3 gap-3">
                {isNew && <Field label="ID (slug)" value={editing.id} onChange={v => setEditing({ ...editing, id: v })} />}
                <Field label="Display Name" value={editing.label} onChange={v => setEditing({ ...editing, label: v })} />
                <Field label="Shopify Tag" value={editing.tag} onChange={v => setEditing({ ...editing, tag: v })} />
                <Field label="Sort Order" value={String(editing.sortOrder)} onChange={v => setEditing({ ...editing, sortOrder: Number(v) })} type="number" />
              </div>
            </Section>

            <Section title="Pricing">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Monthly Fee ($)" value={editing.monthlyFee ?? ''} onChange={v => setEditing({ ...editing, monthlyFee: v || null })} type="number" />
                <Field label="Annual Fee ($)" value={editing.annualFee ?? ''} onChange={v => setEditing({ ...editing, annualFee: v || null })} type="number" />
                <Field label="Monthly Credit ($)" value={editing.monthlyCredit} onChange={v => setEditing({ ...editing, monthlyCredit: v })} type="number" />
                <Field label="Birthday Credit ($)" value={editing.birthdayCredit} onChange={v => setEditing({ ...editing, birthdayCredit: v })} type="number" />
              </div>
            </Section>

            <Section title="Second Sight">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Trade-in Rate (%)</div>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" max="100" step="0.5" value={Math.round(Number(editing.tradeInRate) * 1000) / 10}
                      onChange={e => setEditing({ ...editing, tradeInRate: String(Number(e.target.value) / 100) })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded text-sm" />
                    <span className="text-sm text-neutral-400">%</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Second Sight Rate (%)</div>
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" max="100" step="0.5" value={editing.secondSightRate ? Math.round(Number(editing.secondSightRate) * 1000) / 10 : ''}
                      onChange={e => setEditing({ ...editing, secondSightRate: e.target.value ? String(Number(e.target.value) / 100) : null })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded text-sm" placeholder="Same as trade-in" />
                    <span className="text-sm text-neutral-400">%</span>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Access & Service">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Shipping Tier</div>
                  <select value={editing.shippingTier ?? ''} onChange={e => setEditing({ ...editing, shippingTier: e.target.value || null })} className="w-full px-3 py-2 border border-neutral-200 rounded text-sm">
                    <option value="">None</option>
                    <option value="standard">Standard (free)</option>
                    <option value="priority">Priority</option>
                    <option value="overnight">Overnight</option>
                  </select>
                </div>
                <Field label="Early Access (hours)" value={String(editing.earlyAccessHours)} onChange={v => setEditing({ ...editing, earlyAccessHours: Number(v) })} type="number" />
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Free Repairs</div>
                  <select value={editing.freeRepairs ?? ''} onChange={e => setEditing({ ...editing, freeRepairs: e.target.value || null })} className="w-full px-3 py-2 border border-neutral-200 rounded text-sm">
                    <option value="">None</option>
                    <option value="1/yr">1 per year</option>
                    <option value="2/yr">2 per year</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Style Consultation</div>
                  <select value={editing.styleConsultation ?? ''} onChange={e => setEditing({ ...editing, styleConsultation: e.target.value || null })} className="w-full px-3 py-2 border border-neutral-200 rounded text-sm">
                    <option value="">None</option>
                    <option value="15 min/yr">15 min/year</option>
                    <option value="30 min/yr">30 min/year</option>
                    <option value="60 min/yr">60 min/year</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Frame Rotation</div>
                  <select value={editing.frameRotation ?? ''} onChange={e => setEditing({ ...editing, frameRotation: e.target.value || null })} className="w-full px-3 py-2 border border-neutral-200 rounded text-sm">
                    <option value="">None</option>
                    <option value="10% off">10% off</option>
                    <option value="25% off">25% off</option>
                    <option value="50% off">50% off</option>
                    <option value="Free swap">Free swap (1/yr)</option>
                  </select>
                </div>
                <Field label="Events/Year" value={String(editing.eventsPerYear)} onChange={v => setEditing({ ...editing, eventsPerYear: Number(v) })} type="number" />
              </div>
            </Section>

            <Section title="Referral Rewards">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Referrer Credit ($)" value={editing.referralRewardCredit ?? ''} onChange={v => setEditing({ ...editing, referralRewardCredit: v || null })} type="number" />
                <Field label="Referrer Extension (months)" value={String(editing.referralExtensionMonths)} onChange={v => setEditing({ ...editing, referralExtensionMonths: Number(v) })} type="number" />
                <Field label="Referred Discount ($)" value={editing.referredDiscount ?? ''} onChange={v => setEditing({ ...editing, referredDiscount: v || null })} type="number" />
                <div>
                  <div className="text-xs text-neutral-400 mb-1">Referred Trial Tier</div>
                  <select value={editing.referredTrialTier ?? ''} onChange={e => setEditing({ ...editing, referredTrialTier: e.target.value || null })} className="w-full px-3 py-2 border border-neutral-200 rounded text-sm">
                    <option value="">None</option>
                    <option value="essential">Essential</option>
                    <option value="cult">CULT</option>
                    <option value="vault">VAULT</option>
                  </select>
                </div>
              </div>
            </Section>

            <Section title="Perks">
              <div className="flex flex-wrap gap-4">
                {([
                  ['lensRefresh', 'Lens Refresh'],
                  ['namedOptician', 'Named Optician'],
                  ['annualGift', 'Annual Gift'],
                  ['archiveVote', 'Archive Vote'],
                  ['privateWhatsapp', 'Private WhatsApp'],
                  ['active', 'Active'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={(editing as any)[key]} onChange={e => setEditing({ ...editing, [key]: e.target.checked })} /> {label}
                  </label>
                ))}
              </div>
            </Section>

            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm border rounded hover:bg-neutral-50">Cancel</button>
              <button onClick={handleSave} disabled={saving || !editing.label || !editing.tag} className="px-4 py-2 text-sm bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-400 mb-1">{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} type={type ?? 'text'} placeholder={placeholder} className="w-full px-3 py-2 border border-neutral-200 rounded text-sm" />
    </div>
  );
}
