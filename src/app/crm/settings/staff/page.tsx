import { requirePermission } from '@/lib/crm/auth';
import { StaffManagementClient } from './StaffManagementClient';

async function fetchFromClerk(path: string) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return [];
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || data || [];
}

export default async function StaffSettingsPage() {
  await requirePermission('org:settings:staff');

  const [rawUsers, rawInvitations] = await Promise.all([
    fetchFromClerk('/users?limit=50&order_by=-created_at'),
    fetchFromClerk('/invitations?status=pending&limit=50'),
  ]);

  const staff = rawUsers.map((u: Record<string, unknown>) => {
    const meta = (u.public_metadata ?? {}) as Record<string, unknown>;
    const emails = (u.email_addresses ?? []) as Array<{ email_address: string }>;
    return {
      id: u.id as string,
      firstName: u.first_name as string | null,
      lastName: u.last_name as string | null,
      email: emails[0]?.email_address ?? null,
      imageUrl: u.image_url as string | null,
      role: (meta.role as string) || 'read_only',
      locationIds: (meta.location_ids as string[]) || [],
      banned: u.banned as boolean ?? false,
      offboarded: (meta.offboarded as boolean) ?? false,
    };
  });

  const invitations = rawInvitations.map((inv: Record<string, unknown>) => {
    const meta = (inv.public_metadata ?? {}) as Record<string, unknown>;
    return {
      id: inv.id as string,
      emailAddress: inv.email_address as string,
      role: (meta.role as string) || 'sa',
      locationIds: (meta.location_ids as string[]) || [],
      createdAt: inv.created_at as string,
    };
  });

  return <StaffManagementClient staff={staff} invitations={invitations} />;
}
