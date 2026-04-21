import Link from 'next/link';
import { requirePermission } from '@/lib/crm/auth';
import ResetTourButton from './ResetTourButton';

const SETTINGS_GROUPS = [
  {
    title: 'Products',
    items: [
      { href: '/crm/settings/families', label: 'Families', description: 'Group products by model for colour/type switching' },
      { href: '/crm/settings/filters', label: 'Filters', description: 'Manage colour, shape, size filter assignments' },
      { href: '/crm/settings/product-mapping', label: 'Square Mapping', description: 'Link Square catalog items to Shopify products' },
    ],
  },
  {
    title: 'Team',
    items: [
      { href: '/crm/settings/staff', label: 'Staff', description: 'Staff accounts and role assignment' },
      { href: '/crm/settings/locations', label: 'Locations', description: 'Store locations and assignment' },
      { href: '/crm/settings/appointment-types', label: 'Appointments', description: 'Services offered for booking' },
    ],
  },
  {
    title: 'Customers',
    items: [
      { href: '/crm/settings/tags', label: 'Tags', description: 'Customer tag taxonomy' },
      { href: '/crm/settings/loyalty', label: 'Loyalty', description: 'Membership tiers, credits, and perks' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/crm/settings/integrations', label: 'Integrations', description: 'Third-party services and APIs' },
      { href: '/crm/settings/store', label: 'Store Config', description: 'Timezone, API versions, SKUs, thresholds' },
      { href: '/crm/settings/audit', label: 'Audit Log', description: 'All system activity' },
      { href: '/crm/settings/system', label: 'System', description: 'Sync, reconciliation, data maintenance' },
    ],
  },
];

export default async function SettingsPage() {
  await requirePermission('org:settings:staff');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.title} className="mb-8">
          <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">{group.title}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map((s) => (
              <Link key={s.href} href={s.href} className="bg-white border border-neutral-200 rounded p-4 hover:shadow-sm transition-shadow">
                <h3 className="font-medium text-sm">{s.label}</h3>
                <p className="text-xs text-neutral-500 mt-1">{s.description}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="pt-6 border-t border-neutral-200">
        <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">Onboarding</h2>
        <ResetTourButton />
      </div>
    </div>
  );
}
