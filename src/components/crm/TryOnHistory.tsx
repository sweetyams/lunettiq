'use client';

import { useState, useEffect } from 'react';

interface Session {
  date: string;
  framesTried: number;
  outcome: string;
}

export function TryOnHistory({ customerId }: { customerId: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/crm/clients/${customerId}/tryon-sessions`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setSessions(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [customerId]);

  if (!loaded) return null;
  if (!sessions.length) return <p style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No try-on sessions</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2)' }}>
      {sessions.map((s, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--crm-text-sm)', padding: '2px 0' }}>
          <div>
            <span>{new Date(s.date).toLocaleDateString()}</span>
            <span style={{ color: 'var(--crm-text-secondary)', marginLeft: 'var(--crm-space-2)' }}>{s.framesTried} frames</span>
          </div>
          <span className="crm-badge" style={{ background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)' }}>{s.outcome}</span>
        </div>
      ))}
    </div>
  );
}
