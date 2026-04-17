import { db } from '@/lib/db';
import { auditLog } from '@/lib/db/schema';
import { headers } from 'next/headers';
import type { CrmSession } from './auth';

type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'consent_change' | 'tag_change' | 'credit_adjustment' | 'sync';

export async function writeAudit(params: {
  session: CrmSession;
  action: AuditAction;
  entityType: string;
  entityId: string;
  diff?: Record<string, unknown>;
}): Promise<void> {
  const h = await headers();
  const surface = (h.get('x-crm-surface') ?? 'web') as 'web' | 'tablet' | 'phone' | 'storefront' | 'system';

  await db.insert(auditLog).values({
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    staffId: params.session.userId,
    actorRole: params.session.role,
    surface,
    locationId: params.session.primaryLocationId,
    diff: params.diff,
    status: 'success',
  });
}

export async function writeAuthFailure(params: {
  staffId?: string;
  action: string;
  entityType: string;
  entityId?: string;
}): Promise<void> {
  const h = await headers();
  const surface = (h.get('x-crm-surface') ?? 'web') as 'web' | 'tablet' | 'phone' | 'storefront' | 'system';

  await db.insert(auditLog).values({
    action: 'login',
    entityType: params.entityType,
    entityId: params.entityId ?? 'unknown',
    staffId: params.staffId,
    surface,
    diff: { attemptedAction: params.action },
    status: 'denied',
  });
}
