import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';

export async function createNotification(opts: {
  userId: string;
  title: string;
  body?: string;
  type?: string;
  entityType?: string;
  entityId?: string;
}) {
  await db.insert(notifications).values({
    userId: opts.userId,
    title: opts.title,
    body: opts.body ?? null,
    type: opts.type ?? 'info',
    entityType: opts.entityType ?? null,
    entityId: opts.entityId ?? null,
  });
}

/** Notify all staff with a given role (or all staff if no role specified) */
export async function notifyStaff(opts: {
  title: string;
  body?: string;
  type?: string;
  entityType?: string;
  entityId?: string;
  staffIds?: string[];
}) {
  let ids = opts.staffIds;
  if (!ids) {
    // Fetch all staff from Clerk
    const secret = process.env.CLERK_SECRET_KEY;
    if (!secret) return;
    try {
      const res = await fetch('https://api.clerk.com/v1/users?limit=50', { headers: { Authorization: `Bearer ${secret}` } });
      if (res.ok) { const d = await res.json(); ids = (d.data || d || []).map((u: any) => u.id); }
    } catch { return; }
  }
  if (!ids?.length) return;
  await db.insert(notifications).values(ids.map(userId => ({
    userId,
    title: opts.title,
    body: opts.body ?? null,
    type: opts.type ?? 'info',
    entityType: opts.entityType ?? null,
    entityId: opts.entityId ?? null,
  })));
}
