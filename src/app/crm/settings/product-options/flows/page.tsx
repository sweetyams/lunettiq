import { requirePermission } from '@/lib/crm/auth';
import FlowsClient from './FlowsClient';

export default async function FlowsPage() {
  await requirePermission('org:settings:business_config');
  return <FlowsClient />;
}
