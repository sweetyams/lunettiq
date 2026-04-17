'use client';

export default function CrmError({ error }: { error: Error & { status?: number } }) {
  const is401 = error.message === 'Unauthorized' || error.status === 401;
  const is403 = error.message === 'Forbidden' || error.status === 403;

  if (is401) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: 'var(--crm-text-primary)' }}>Access Denied</h2>
        <p style={{ color: 'var(--crm-text-secondary)', fontSize: 'var(--crm-text-sm)' }}>Your account doesn't have a CRM role assigned. Contact an owner to get access.</p>
      </div>
    );
  }

  if (is403) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: 'var(--crm-text-primary)' }}>Forbidden</h2>
        <p style={{ color: 'var(--crm-text-secondary)', fontSize: 'var(--crm-text-sm)' }}>You don't have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: 'var(--crm-text-primary)' }}>Something went wrong</h2>
      <p style={{ color: 'var(--crm-text-secondary)', fontSize: 'var(--crm-text-sm)' }}>{error.message}</p>
    </div>
  );
}
