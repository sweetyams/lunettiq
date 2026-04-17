'use client';

export interface StaffMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
}

interface Props {
  staff: StaffMember[];
  value: string | null;
  onChange: (staffId: string | null) => void;
}

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="crm-btn" style={{
      padding: '4px 12px', fontSize: 'var(--crm-text-sm)', borderRadius: 'var(--crm-radius-full)',
      border: `1px solid ${selected ? 'var(--crm-text-primary)' : 'var(--crm-border)'}`,
      background: selected ? 'var(--crm-text-primary)' : 'var(--crm-surface)',
      color: selected ? 'var(--crm-text-inverse)' : 'var(--crm-text-secondary)',
    }}>{children}</button>
  );
}

export function StaffPicker({ staff, value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 'var(--crm-space-2)', flexWrap: 'wrap' }}>
      <Pill selected={!value} onClick={() => onChange(null)}>All</Pill>
      {staff.map(s => (
        <Pill key={s.id} selected={value === s.id} onClick={() => onChange(value === s.id ? null : s.id)}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2)' }}>
            {s.imageUrl && <img src={s.imageUrl} alt="" style={{ width: 18, height: 18, borderRadius: '50%' }} />}
            {s.firstName ?? 'Staff'}
          </span>
        </Pill>
      ))}
    </div>
  );
}
