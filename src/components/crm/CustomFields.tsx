'use client';

import { useState } from 'react';

interface Field { key: string; value: string }

interface Props {
  customerId: string;
  fields: Field[];
  onSave: (fields: Field[]) => void;
}

export function CustomFields({ customerId: _, fields, onSave }: Props) {
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  function handleAdd() {
    if (!newKey.trim()) return;
    const updated = [...fields, { key: newKey.trim(), value: newValue.trim() }];
    onSave(updated);
    setNewKey('');
    setNewValue('');
    setAdding(false);
  }

  return (
    <div>
      {fields.map((f, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--crm-space-2) 0', borderBottom: '1px solid var(--crm-border-light)', fontSize: 'var(--crm-text-sm)' }}>
          <span style={{ color: 'var(--crm-text-secondary)' }}>{f.key}</span>
          <span style={{ color: 'var(--crm-text-primary)' }}>{f.value}</span>
        </div>
      ))}

      {adding ? (
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)', marginTop: 'var(--crm-space-3)', alignItems: 'center' }}>
          <input value={newKey} onChange={e => setNewKey(e.target.value)} className="crm-input" placeholder="Key" style={{ flex: 1 }} />
          <input value={newValue} onChange={e => setNewValue(e.target.value)} className="crm-input" placeholder="Value" style={{ flex: 1 }} />
          <button onClick={handleAdd} disabled={!newKey.trim()} className="crm-btn crm-btn-primary" style={{ whiteSpace: 'nowrap' }}>Save</button>
          <button onClick={() => setAdding(false)} className="crm-btn crm-btn-secondary">✕</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="crm-btn crm-btn-secondary" style={{ marginTop: 'var(--crm-space-3)', fontSize: 'var(--crm-text-sm)' }}>
          + Add field
        </button>
      )}
    </div>
  );
}
