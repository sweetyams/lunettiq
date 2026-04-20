'use client';

import { useState } from 'react';

interface Props {
  customerId: string;
  tags: string[];
  onChanged?: (tags: string[]) => void;
}

export function TagManager({ customerId, tags: initial, onChanged }: Props) {
  const [tags, setTags] = useState(initial);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function addTag() {
    const tag = input.trim();
    if (!tag || tags.includes(tag)) return;
    const prev = tags;
    setTags([...tags, tag]);
    setInput('');
    onChanged?.([...tags, tag]);
    const res = await fetch(`/api/crm/clients/${customerId}/tags`, { credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', tag }),
    });
    if (!res.ok) { setTags(prev); onChanged?.(prev); }
  }

  async function removeTag(tag: string) {
    const prev = tags;
    const next = tags.filter(t => t !== tag);
    setTags(next);
    onChanged?.(next);
    const res = await fetch(`/api/crm/clients/${customerId}/tags`, { credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', tag }),
    });
    if (!res.ok) { setTags(prev); onChanged?.(prev); }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded text-xs">
            {t}
            <button onClick={() => removeTag(t)} disabled={busy} className="text-neutral-400 hover:text-neutral-600" aria-label={`Remove ${t}`}>×</button>
          </span>
        ))}
        {!tags.length && <span className="text-xs text-neutral-400">No tags</span>}
      </div>
      <div className="flex gap-1.5">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder="Add tag…"
          className="flex-1 px-2 py-1 border border-neutral-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
        <button onClick={addTag} disabled={busy || !input.trim()}
          className="px-2 py-1 bg-neutral-900 text-white text-xs rounded hover:bg-neutral-800 disabled:opacity-50">+</button>
      </div>
    </div>
  );
}
