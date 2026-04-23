'use client';

import Link from 'next/link';

export default function CrmError({ error, reset }: { error: Error & { status?: number; digest?: string }; reset: () => void }) {
  const is401 = error.message === 'Unauthorized' || error.status === 401;
  const is403 = error.message === 'Forbidden' || error.status === 403;
  // In production, Next.js strips error messages from Server Components.
  // The digest may contain clues, but we can't rely on it.
  // Treat any unrecognized RSC error as a likely permission issue.
  const isLikelyPermission = is401 || is403;

  if (isLikelyPermission) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: 'var(--crm-text-primary)' }}>
          {is401 ? 'Access Denied' : 'Forbidden'}
        </h2>
        <p style={{ color: 'var(--crm-text-secondary)', fontSize: 'var(--crm-text-sm)' }}>
          {is401
            ? "Your account doesn't have a CRM role assigned. Contact an owner to get access."
            : "You don't have permission to view this page."}
        </p>
        <Link href="/crm" className="crm-btn crm-btn-secondary" style={{ marginTop: 8 }}>← Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: 'var(--crm-text-primary)' }}>Something went wrong</h2>
      <p style={{ color: 'var(--crm-text-secondary)', fontSize: 'var(--crm-text-sm)' }}>
        An unexpected error occurred. This may be a permissions issue.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={reset} className="crm-btn crm-btn-primary">Try again</button>
        <Link href="/crm" className="crm-btn crm-btn-secondary">← Back to Dashboard</Link>
      </div>
    </div>
  );
}
