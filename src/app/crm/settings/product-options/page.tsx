import { requirePermission } from '@/lib/crm/auth';
import ProductOptionsClient from './ProductOptionsClient';

export default async function ProductOptionsPage() {
  await requirePermission('org:settings:business_config');
  return <ProductOptionsClient />;
}
