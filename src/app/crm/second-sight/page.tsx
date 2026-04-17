import { requirePermission } from '@/lib/crm/auth';
import { db } from '@/lib/db';
import { secondSightIntakes, customersProjection } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';

export default async function SecondSightPage() {
  await requirePermission('org:second_sight:read');
  const intakes = await db
    .select({
      id: secondSightIntakes.id,
      status: secondSightIntakes.status,
      grade: secondSightIntakes.grade,
      createdAt: secondSightIntakes.createdAt,
      shopifyCustomerId: secondSightIntakes.shopifyCustomerId,
      firstName: customersProjection.firstName,
      lastName: customersProjection.lastName,
    })
    .from(secondSightIntakes)
    .leftJoin(customersProjection, eq(secondSightIntakes.shopifyCustomerId, customersProjection.shopifyCustomerId))
    .orderBy(desc(secondSightIntakes.createdAt))
    .limit(100);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Second Sight</h1>
        <Link href="/crm/second-sight/new" className="px-4 py-2 bg-neutral-900 text-white text-sm rounded hover:bg-neutral-800">
          New Intake
        </Link>
      </div>

      <div className="bg-white border border-neutral-200 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-neutral-600">Client</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-600">Grade</th>
              <th className="text-left px-4 py-3 font-medium text-neutral-600">Date</th>
            </tr>
          </thead>
          <tbody>
            {intakes.map((i) => (
              <tr key={i.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link href={`/crm/clients/${i.shopifyCustomerId}`} className="hover:underline">
                    {i.firstName} {i.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    i.status === 'credited' ? 'bg-green-100 text-green-700' :
                    i.status === 'graded' ? 'bg-blue-100 text-blue-700' :
                    i.status === 'submitted' ? 'bg-amber-100 text-amber-700' :
                    'bg-neutral-100 text-neutral-600'
                  }`}>
                    {i.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-600">{i.grade ?? '—'}</td>
                <td className="px-4 py-3 text-neutral-400">{i.createdAt ? new Date(i.createdAt).toISOString().slice(0, 10) : ''}</td>
              </tr>
            ))}
            {!intakes.length && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-400">No intakes yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
