export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';

export const GET = handler(async (request) => {
  const session = await requireCrmAuth();
  const unreadOnly = request.nextUrl.searchParams.get('unread') === '1';

  const conditions = [eq(notifications.userId, session.userId)];
  if (unreadOnly) conditions.push(isNull(notifications.readAt));

  const rows = await db.select().from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const unreadCount = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, session.userId), isNull(notifications.readAt)));

  return jsonOk({ notifications: rows, unreadCount: Number(unreadCount[0]?.count ?? 0) });
});

export const PATCH = handler(async (request) => {
  const session = await requireCrmAuth();
  const { ids } = await request.json();

  if (ids === 'all') {
    await db.update(notifications).set({ readAt: new Date() })
      .where(and(eq(notifications.userId, session.userId), isNull(notifications.readAt)));
  } else if (Array.isArray(ids)) {
    for (const id of ids) {
      await db.update(notifications).set({ readAt: new Date() })
        .where(and(eq(notifications.id, id), eq(notifications.userId, session.userId)));
    }
  }

  return jsonOk({ ok: true });
});
