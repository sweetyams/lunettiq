import { getStoreLocations } from '@/lib/shopify/queries/metaobjects';
import type { StoreLocation } from '@/types/metaobjects';

export const revalidate = 300;

export default async function StoresPage() {
  let stores: StoreLocation[] = [];

  try {
    const all = await getStoreLocations();
    stores = all.filter((s) => s.active);
  } catch {}

  // Fallback: load from CRM database if Shopify metaobjects are empty
  if (stores.length === 0) {
    try {
      const { db } = await import('@/lib/db');
      const { locations } = await import('@/lib/db/schema');
      const { eq } = await import('drizzle-orm');
      const rows = await db.select().from(locations).where(eq(locations.active, true));
      stores = rows.map(r => {
        const addr = (r.address ?? {}) as Record<string, string>;
        return {
          name: r.name,
          streetAddress: addr.address1 ?? '',
          city: addr.city ?? 'Montreal',
          province: addr.province ?? 'QC',
          postalCode: addr.zip ?? '',
          phone: addr.phone ?? '',
          mapUrl: addr.address1 ? `https://maps.google.com/?q=${encodeURIComponent(`${addr.address1}, ${addr.city ?? 'Montreal'}`)}` : '',
          hours: {} as Record<string, string>,
          active: true,
        };
      });
    } catch {}
  }

  if (stores.length === 0) {
    return (
      <div className="site-container py-12">
        <h1 className="text-2xl font-medium mb-8">Our Stores</h1>
        <p className="text-gray-500">No store locations available at this time.</p>
      </div>
    );
  }

  return (
    <div className="site-container py-12">
      <h1 className="text-2xl font-medium mb-8">Our Stores</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stores.map((store) => (
          <StoreCard key={store.name} store={store} />
        ))}
      </div>
    </div>
  );
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function StoreCard({ store }: { store: StoreLocation }) {
  const sortedHours = DAY_ORDER
    .filter((day) => store.hours[day])
    .map((day) => ({ day, hours: store.hours[day] }));

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <h2 className="text-lg font-medium mb-2">{store.name}</h2>
      <p className="text-sm text-gray-600">
        {store.streetAddress}
        <br />
        {store.city}, {store.province} {store.postalCode}
      </p>
      {store.phone && (
        <p className="text-sm text-gray-600 mt-1">
          <a href={`tel:${store.phone}`} className="hover:text-black">
            {store.phone}
          </a>
        </p>
      )}

      {/* Hours */}
      {sortedHours.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Hours</p>
          <div className="space-y-0.5">
            {sortedHours.map(({ day, hours }) => (
              <div key={day} className="flex justify-between text-xs">
                <span className="capitalize text-gray-600">{day}</span>
                <span>{hours}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Directions link */}
      {store.mapUrl && (
        <a
          href={store.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center mt-4 text-sm text-blue-600 hover:underline min-h-[44px]"
        >
          Get Directions →
        </a>
      )}
    </div>
  );
}
