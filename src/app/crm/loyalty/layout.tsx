'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/crm/loyalty', label: 'Overview' },
  { href: '/crm/loyalty/referrals', label: 'Referrals' },
  { href: '/crm/loyalty/trials', label: 'Trials' },
  { href: '/crm/loyalty/events', label: 'Events' },
  { href: '/crm/loyalty/gifts', label: 'Gifts' },
  { href: '/crm/settings/loyalty', label: 'Settings' },
];

export default function LoyaltyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/crm/loyalty') return pathname === '/crm/loyalty';
    return pathname.startsWith(href);
  }

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, marginBottom: 'var(--crm-space-4)' }}>Loyalty</h1>
      <div style={{ display: 'flex', gap: 0, marginBottom: 'var(--crm-space-5)', borderBottom: '1px solid var(--crm-border-light)' }}>
        {TABS.map(tab => (
          <Link key={tab.href} href={tab.href} style={{
            padding: '8px 16px', fontSize: 'var(--crm-text-sm)', textDecoration: 'none',
            borderBottom: isActive(tab.href) ? '2px solid var(--crm-text-primary)' : '2px solid transparent',
            color: isActive(tab.href) ? 'var(--crm-text-primary)' : 'var(--crm-text-tertiary)',
            fontWeight: isActive(tab.href) ? 500 : 400,
          }}>{tab.label}</Link>
        ))}
      </div>
      {children}
    </div>
  );
}
