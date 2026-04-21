import { requirePermission } from '@/lib/crm/auth';
import { FamiliesView } from '../FamiliesView';

export default async function FamiliesPage() {
  await requirePermission('org:products:read');
  return <FamiliesView />;
}
