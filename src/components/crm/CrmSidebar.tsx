'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useUser } from '@clerk/nextjs';

const NAV = [
  { href: '/crm', label: 'Home', icon: <HomeIcon /> },
  { href: '/crm/clients', label: 'Clients', icon: <UsersIcon /> },
  { href: '/crm/products', label: 'Products', icon: <BoxIcon /> },
  { href: '/crm/segments', label: 'Segments', icon: <FilterIcon /> },
  { href: '/crm/appointments', label: 'Appointments', icon: <CalendarIcon /> },
  { href: '/crm/reports', label: 'Reports', icon: <ChartIcon /> },
];

const ADMIN = [
  { href: '/crm/settings', label: 'Settings', icon: <GearIcon /> },
];

function isActive(pathname: string, href: string) {
  if (href === '/crm') return pathname === '/crm';
  return pathname.startsWith(href);
}

export function CrmSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const meta = (user?.publicMetadata ?? {}) as { role?: string; locationIds?: string[] };
  const role = meta.role || 'sa';

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{
        width: 'var(--crm-sidebar-width)',
        background: 'var(--crm-surface)',
        borderRight: '1px solid var(--crm-border)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center h-11 px-4" style={{ borderBottom: '1px solid var(--crm-border)' }}>
        <Link href="/crm" className="flex items-center gap-2" style={{ textDecoration: 'none', color: 'var(--crm-text-primary)' }}>
          <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: '-0.02em' }}>Lunettiq</span>
          <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', fontWeight: 500 }}>CRM</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors"
            style={{
              fontSize: 'var(--crm-text-sm)',
              fontWeight: isActive(pathname, item.href) ? 500 : 400,
              color: isActive(pathname, item.href) ? 'var(--crm-text-primary)' : 'var(--crm-text-secondary)',
              background: isActive(pathname, item.href) ? 'var(--crm-surface-hover)' : 'transparent',
              textDecoration: 'none',
            }}
          >
            <span style={{ opacity: isActive(pathname, item.href) ? 1 : 0.6 }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--crm-border-light)', margin: '8px 0' }} />

        {ADMIN.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors"
            style={{
              fontSize: 'var(--crm-text-sm)',
              fontWeight: isActive(pathname, item.href) ? 500 : 400,
              color: isActive(pathname, item.href) ? 'var(--crm-text-primary)' : 'var(--crm-text-secondary)',
              background: isActive(pathname, item.href) ? 'var(--crm-surface-hover)' : 'transparent',
              textDecoration: 'none',
            }}
          >
            <span style={{ opacity: isActive(pathname, item.href) ? 1 : 0.6 }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="flex items-center gap-2 px-3 py-3" style={{ borderTop: '1px solid var(--crm-border)' }}>
        <UserButton afterSignOutUrl="/crm" />
        <div className="min-w-0">
          <div className="truncate" style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>
            {user?.firstName} {user?.lastName}
          </div>
          <div className="truncate" style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
            {role}
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Icons (16x16 stroke icons, Untitled UI style) ──────

function HomeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function UsersIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function BoxIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
}
function FilterIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>;
}
function CalendarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
function ChartIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}
function GearIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
}
