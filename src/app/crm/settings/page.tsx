import Link from 'next/link';
import { requirePermission } from '@/lib/crm/auth';

const SETTINGS_SECTIONS = [
  { href: '/crm/settings/tags', label: 'Tags', description: 'Manage customer tag taxonomy' },
  { href: '/crm/settings/locations', label: 'Locations', description: 'Store locations and assignment' },
  { href: '/crm/settings/staff', label: 'Staff', description: 'Staff accounts and role assignment' },
  { href: '/crm/settings/audit', label: 'Audit Log', description: 'View all system activity' },
];

export default async function SettingsPage() {
  await requirePermission('org:settings:staff');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>
      <div className="grid grid-cols-2 gap-4">
        {SETTINGS_SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="bg-white border border-neutral-200 rounded p-4 hover:shadow-sm transition-shadow">
            <h3 className="font-medium">{s.label}</h3>
            <p className="text-sm text-neutral-500 mt-1">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
