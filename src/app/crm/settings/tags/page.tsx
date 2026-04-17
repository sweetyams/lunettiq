import { requirePermission } from '@/lib/crm/auth';

export default async function TagsSettingsPage() {
  await requirePermission('org:settings:tags');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Tag Management</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Tags are managed in Shopify and synced via webhooks. Use this page to view and organize the tag taxonomy.
      </p>
      <div className="bg-white border border-neutral-200 rounded p-4 text-sm text-neutral-400">
        Tag taxonomy management will pull from the customers_projection tags column. Coming soon.
      </div>
    </div>
  );
}
