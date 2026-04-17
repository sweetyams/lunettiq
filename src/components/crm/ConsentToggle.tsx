'use client';

import { useState } from 'react';
import { usePermission } from '@/lib/crm/use-permissions';

interface Props {
  customerId: string;
  label: string;
  field: 'accepts_marketing' | 'smsConsent';
  metafieldKey: string;
  enabled: boolean;
  onToggled?: (newValue: boolean) => void;
}

const SOURCES = ['Client requested verbally', 'Client requested by email', 'Staff decision'] as const;

export function ConsentToggle({ customerId, label, field, metafieldKey, enabled, onToggled }: Props) {
  const canUpdate = usePermission('org:consent:update');
  const [value, setValue] = useState(enabled);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingValue, setPendingValue] = useState(false);
  const [reason, setReason] = useState('');
  const [source, setSource] = useState<string>(SOURCES[0]);

  function requestToggle() {
    if (!canUpdate) return;
    setPendingValue(!value);
    setReason('');
    setSource(SOURCES[0]);
    setConfirming(true);
  }

  async function confirm() {
    setSaving(true);
    const body: Record<string, unknown> = {
      metafields: {
        [metafieldKey]: { value: String(pendingValue), type: 'boolean' },
        marketing_consent_updated_at: { value: new Date().toISOString(), type: 'single_line_text_field' },
      },
      _consentChange: { field: metafieldKey, newValue: pendingValue, source, reason },
    };
    if (field === 'accepts_marketing') body.accepts_marketing = pendingValue;

    const res = await fetch(`/api/crm/clients/${customerId}`, {
      credentials: 'include', method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) { setValue(pendingValue); onToggled?.(pendingValue); }
    setSaving(false);
    setConfirming(false);
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--crm-space-2) 0' }}>
        <span style={{ fontSize: 'var(--crm-text-sm)' }}>{label}</span>
        <button onClick={requestToggle} disabled={saving || !canUpdate}
          style={{ position: 'relative', width: 36, height: 20, borderRadius: 10, border: 'none', cursor: canUpdate ? 'pointer' : 'default',
            background: value ? 'var(--crm-success, #16a34a)' : 'var(--crm-border, #d4d4d4)', transition: 'background 0.2s' }}>
          <span style={{ position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%', background: '#fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left 0.2s', left: value ? 18 : 2 }} />
        </button>
      </div>

      {confirming && (
        <>
          <div onClick={() => setConfirming(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
          <div style={{ position: 'fixed', top: '25%', left: '50%', transform: 'translateX(-50%)', width: 400, background: 'var(--crm-surface)', borderRadius: 'var(--crm-radius-xl)', boxShadow: 'var(--crm-shadow-overlay)', padding: 'var(--crm-space-6)', zIndex: 51 }}>
            <h3 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>Change {label.toLowerCase()}?</h3>
            <p style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)', marginBottom: 'var(--crm-space-4)' }}>
              {pendingValue
                ? `This will opt the client in to ${label.toLowerCase()}.`
                : `This will opt the client out of ${label.toLowerCase()}. Transactional messages still send.`}
            </p>

            <div style={{ marginBottom: 'var(--crm-space-4)' }}>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Reason (optional)</div>
              <input value={reason} onChange={e => setReason(e.target.value)} className="crm-input" style={{ width: '100%' }} placeholder="Why is this changing?" />
            </div>

            <div style={{ marginBottom: 'var(--crm-space-4)' }}>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Source</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2)' }}>
                {SOURCES.map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2)', fontSize: 'var(--crm-text-sm)', cursor: 'pointer' }}>
                    <input type="radio" name="consent-source" checked={source === s} onChange={() => setSource(s)} />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--crm-space-2)', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirming(false)} className="crm-btn crm-btn-secondary">Cancel</button>
              <button onClick={confirm} disabled={saving} className="crm-btn crm-btn-primary">{saving ? 'Saving…' : 'Confirm change'}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
