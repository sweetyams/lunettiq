import { requirePermission } from '@/lib/crm/auth';
import { ReportsClient } from './ReportsClient';

export default async function ReportsPage() {
  await requirePermission('org:reports:read');
  return <ReportsClient />;
}
