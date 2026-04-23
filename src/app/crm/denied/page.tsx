import Link from 'next/link';

export default function DeniedPage() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: 'var(--crm-text-primary)' }}>Forbidden</h2>
      <p style={{ color: 'var(--crm-text-secondary)', fontSize: 'var(--crm-text-sm)' }}>
        You don&apos;t have permission to view this page.
      </p>
      <Link href="/crm" className="crm-btn crm-btn-secondary" style={{ marginTop: 8 }}>← Back to Dashboard</Link>
    </div>
  );
}
