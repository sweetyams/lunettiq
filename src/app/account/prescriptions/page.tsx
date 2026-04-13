import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerMetafield } from '@/lib/shopify/customer';
import type { PrescriptionRecord } from '@/types/customer';
import PrescriptionsClient from './PrescriptionsClient';

export const dynamic = 'force-dynamic';

export default async function PrescriptionsPage() {
  const accessToken = getAccessToken();
  let records: PrescriptionRecord[] = [];

  try {
    const data = await getCustomerMetafield<{ records: PrescriptionRecord[] }>(
      'custom',
      'prescriptions',
      accessToken ?? undefined
    );
    records = data?.records ?? [];
  } catch {
    // handled in UI
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-medium mb-8">My Prescriptions</h1>
      <PrescriptionsClient initialRecords={records} />
    </div>
  );
}
