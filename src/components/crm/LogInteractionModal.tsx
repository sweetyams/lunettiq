'use client';

import { useState } from 'react';
import { useToast } from '@/components/crm/CrmShell';

interface Props {
  customerId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function LogInteractionModal({ customerId, open, onClose, onSaved }: Props) {
  const [type, setType] = useState('note');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  if (!open) return null;

  async function handleSubmit() {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/crm/interactions', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopifyCustomerId: customerId, type, subject: title || null, body, direction: 'outbound' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save');
      toast('Interaction logged');
      onSaved();
      onClose();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '25%', left: '50%', transform: 'translateX(-50%)', width: 400, background: 'var(--crm-surface)', borderRadius: 'var(--crm-radius-xl)', boxShadow: 'var(--crm-shadow-overlay)', padding: 'var(--crm-space-6)', zIndex: 51 }}>
        <h3 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, marginBottom: 'var(--crm-space-4)' }}>Log Interaction</h3>

        <div style={{ marginBottom: 'var(--crm-space-3)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Type</div>
          <select value={type} onChange={e => setType(e.target.value)} className="crm-input" style={{ width: '100%' }}>
            <option value="note">Note</option>
            <option value="call">Call</option>
            <option value="visit">Visit</option>
          </select>
        </div>

        <div style={{ marginBottom: 'var(--crm-space-3)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Title (optional)</div>
          <input value={title} onChange={e => setTitle(e.target.value)} className="crm-input" style={{ width: '100%' }} placeholder="Subject" />
        </div>

        <div style={{ marginBottom: 'var(--crm-space-4)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Body</div>
          <textarea value={body} onChange={e => setBody(e.target.value)} className="crm-input" style={{ width: '100%', minHeight: 80, resize: 'vertical' }} placeholder="Details…" />
        </div>

        <div style={{ display: 'flex', gap: 'var(--crm-space-2)', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="crm-btn crm-btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !body.trim()} className="crm-btn crm-btn-primary">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}
