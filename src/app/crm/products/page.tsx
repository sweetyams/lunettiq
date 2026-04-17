import { requirePermission } from '@/lib/crm/auth';
import { ProductsClient } from './ProductsClient';

export default async function ProductsPage() {
  await requirePermission('org:products:read');
  return <ProductsClient />;
}
