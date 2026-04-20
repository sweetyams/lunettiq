import { requirePermission } from '@/lib/crm/auth';
import ClientsClient from './ClientsClient';

export default async function ClientsPage() {
  await requirePermission('org:clients:read');
  return <ClientsClient />;
}
