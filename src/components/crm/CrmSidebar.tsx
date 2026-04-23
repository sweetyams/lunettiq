'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useUser } from '@clerk/nextjs';

import { hasPermission, isValidRole, type CrmRole } from '@/lib/crm/permissions';

interface NavItem { href: string; label: string; icon: React.ReactNode; tour?: string; permission?: string }
interface NavGroup { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: '',
    items: [
      { href: '/crm', label: 'Home', icon: <HomeIcon /> },
    ],
  },
  {
    label: 'Clients',
    items: [
      { href: '/crm/clients', label: 'Clients', icon: <UsersIcon />, tour: 'sidebar-clients', permission: 'org:clients:read' },
      { href: '/crm/segments', label: 'Segments', icon: <FilterIcon />, tour: 'sidebar-segments', permission: 'org:segments:read' },
      { href: '/crm/appointments', label: 'Appointments', icon: <CalendarIcon />, tour: 'sidebar-appointments', permission: 'org:appointments:read' },
    ],
  },
  {
    label: 'Orders',
    items: [
      { href: '/crm/orders', label: 'Orders', icon: <ShoppingBagIcon />, permission: 'org:orders:read' },
      { href: '/crm/draft-orders', label: 'Draft Orders', icon: <ClipboardIcon />, permission: 'org:orders:read' },
    ],
  },
  {
    label: 'Products',
    items: [
      { href: '/crm/products', label: 'Products', icon: <BoxIcon />, tour: 'sidebar-products', permission: 'org:products:read' },
      { href: '/crm/products/families', label: 'Families', icon: <CircleIcon />, permission: 'org:products:read' },
      { href: '/crm/inventory', label: 'Inventory', icon: <WarehouseIcon />, permission: 'org:settings:business_config' },
    ],
  },
  {
    label: 'Loyalty',
    items: [
      { href: '/crm/loyalty', label: 'Loyalty', icon: <DiamondIcon />, tour: 'sidebar-loyalty', permission: 'org:membership:read' },
      { href: '/crm/second-sight', label: 'Second Sight', icon: <RecycleIcon />, permission: 'org:second_sight:read' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/crm/reports/sales', label: 'Sales', icon: <ChartIcon />, permission: 'org:reports:read' },
      { href: '/crm/reports/product-analysis', label: 'Analysis', icon: <ChartIcon />, permission: 'org:reports:read' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/crm/settings', label: 'Settings', icon: <GearIcon />, tour: 'sidebar-settings', permission: 'org:settings:staff' },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === '/crm') return pathname === '/crm';
  if (href === '/crm/settings') return pathname === '/crm/settings' || pathname.startsWith('/crm/settings/');
  if (href === '/crm/products') return pathname === '/crm/products' || (pathname.startsWith('/crm/products/') && !pathname.startsWith('/crm/products/families'));
  if (href === '/crm/inventory') return pathname.startsWith('/crm/inventory');
  return pathname === href || pathname.startsWith(href + '/');
}

export function CrmSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const meta = (user?.publicMetadata ?? {}) as { role?: string; locationIds?: string[] };
  const role = meta.role || 'sa';
  const validRole = isValidRole(role) ? role : null;

  const filteredGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item =>
      !item.permission || !validRole || hasPermission(validRole, item.permission)
    ),
  })).filter(group => group.items.length > 0);

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
      <nav className="flex-1 py-2 px-2 overflow-y-auto">
        {filteredGroups.map((group, i) => (
          <div key={group.label || '_home'} style={{ paddingBottom: 8, marginBottom: 8, borderBottom: i < filteredGroups.length - 1 ? '1px solid var(--crm-border-light)' : 'none' }}>
            {group.label && (
              <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: 'var(--crm-text-tertiary)', padding: '6px 10px 2px', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour={item.tour ?? undefined}
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
            </div>
          </div>
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
function ShoppingBagIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
}
function DiamondIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l10 10-10 10L2 12z"/></svg>;
}
function PlugIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8z"/></svg>;
}
function CircleIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>;
}
function ClipboardIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>;
}
function WarehouseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35z"/><line x1="6" y1="18" x2="6" y2="14"/><line x1="10" y1="18" x2="10" y2="12"/><line x1="14" y1="18" x2="14" y2="14"/><line x1="18" y1="18" x2="18" y2="16"/></svg>;
}
function RecycleIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/><path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/><path d="M14 16l3 3-3 3"/><path d="m8.293 13.596-4.6-7.966a1.78 1.78 0 0 1 .012-1.783A1.83 1.83 0 0 1 5.275 3h2.558"/><path d="m12.5 5.5 2-3.5"/><path d="M15.453 5.89 13 9.5"/><path d="m7 19 3-5.5"/></svg>;
}
