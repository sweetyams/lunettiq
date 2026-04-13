import { notFound } from 'next/navigation';
import { storefrontFetch } from '@/lib/shopify/storefront';

export const revalidate = 300;

const PAGE_QUERY = `
  query PageByHandle($handle: String!) {
    page(handle: $handle) {
      id
      title
      body
      bodySummary
    }
  }
`;

interface ShopifyPage {
  id: string;
  title: string;
  body: string;
  bodySummary: string;
}

export default async function StaticPage({
  params,
}: {
  params: { handle: string };
}) {
  // Skip "stores" — handled by dedicated route
  if (params.handle === 'stores') {
    notFound();
  }

  let page: ShopifyPage | null = null;

  try {
    const data = await storefrontFetch<{ page: ShopifyPage | null }>(PAGE_QUERY, {
      handle: params.handle,
    });
    page = data.page;
  } catch {
    // fall through to notFound
  }

  if (!page) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-medium mb-6">{page.title}</h1>
      <div
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: page.body }}
      />
    </div>
  );
}
