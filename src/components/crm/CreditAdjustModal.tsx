'use client';

import { useState } from 'react';

interface Props {
  customerId: string;
  currentBalance: number;
  onClose: () => void;
  onAdjusted: () => void;
  toast: (msg: string, type?: 'success' | 'error') => void;
}

export function CreditAdjustModal({ customerId, currentBalance, onClose, onAdjusted, toast }: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const numAmount = Number(amount) || 0;
  const newBalance = currentBalance + numAmount;

  async function handleSubmit() {
    if (!amount || !reason) return;
    setSaving(true);
    const res = await fetch(`/api/crm/clients/${customerId}/credits`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: numAmount, reason }),
    });
    if (res.ok) { toast('Credit adjusted'); onAdjusted(); onClose(); }
    else { const e = await res.json().catch(() => ({})); toast(e.error || 'Failed', 'error'); }
    setSaving(false);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '25%', left: '50%', transform: 'translateX(-50%)', width: 380, background: 'var(--crm-surface)', borderRadius: 'var(--crm-radius-xl)', boxShadow: 'var(--crm-shadow-overlay)', padding: 'var(--crm-space-6)', zIndex: 51 }}>
        <h3 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, marginBottom: 'var(--crm-space-4)' }}>Adjust Credits</h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--crm-text-sm)', marginBottom: 'var(--crm-space-4)', padding: 'var(--crm-space-3)', background: 'var(--crm-bg)', borderRadius: 'var(--crm-radius-md)' }}>
          <span style={{ color: 'var(--crm-text-tertiary)' }}>Current: ${currentBalance.toFixed(2)}</span>
          <span style={{ fontWeight: 500, color: newBalance >= 0 ? 'var(--crm-text-primary)' : 'var(--crm-error)' }}>New: ${newBalance.toFixed(2)}</span>
        </div>

        <div style={{ marginBottom: 'var(--crm-space-3)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Amount</div>
          <input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.01" className="crm-input" style={{ width: '100%' }} placeholder="Positive to credit, negative to debit" />
        </div>

        <div style={{ marginBottom: 'var(--crm-space-4)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Reason (required)</div>
          <textarea value={reason} onChange={e => setReason(e.target.value)} className="crm-input" style={{ width: '100%', minHeight: 60, resize: 'vertical' }} placeholder="Why is this adjustment being made?" />
        </div>

        <div style={{ display: 'flex', gap: 'var(--crm-space-2)', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="crm-btn crm-btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !amount || !reason} className="crm-btn crm-btn-primary">
            {saving ? 'Saving…' : 'Adjust'}
          </button>
        </div>
      </div>
    </>
  );
}
