import { requirePermission } from '@/lib/crm/auth';
import LensColoursClient from './LensColoursClient';

export default async function LensColoursPage() {
  await requirePermission('org:settings:business_config');
  return <LensColoursClient />;
}
