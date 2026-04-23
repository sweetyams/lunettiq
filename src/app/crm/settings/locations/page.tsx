import { requirePermission } from '@/lib/crm/auth';
import LocationsClient from './LocationsClient';

export default async function LocationsSettingsPage() {
  await requirePermission('org:settings:locations');
  return <LocationsClient />;
}
