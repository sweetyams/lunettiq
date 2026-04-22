import { requirePermission } from '@/lib/crm/auth';
import ChannelsClient from './ChannelsClient';

export default async function ChannelsPage() {
  await requirePermission('org:settings:business_config');
  return <ChannelsClient />;
}
