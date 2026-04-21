import { requirePermission } from '@/lib/crm/auth';
import { FamilyDetailClient } from './FamilyDetailClient';

export default async function FamilyDetailPage({ params }: { params: { id: string } }) {
  await requirePermission('org:products:read');
  return <FamilyDetailClient familyId={params.id} />;
}
