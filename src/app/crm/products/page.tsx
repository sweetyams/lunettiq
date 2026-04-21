import { requirePermission } from '@/lib/crm/auth';
import { CatalogueShell } from './CatalogueShell';

export default async function ProductsPage() {
  await requirePermission('org:products:read');
  return <CatalogueShell />;
}
