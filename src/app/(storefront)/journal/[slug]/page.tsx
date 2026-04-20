import Image from 'next/image';
import { notFound } from 'next/navigation';
import { storefrontFetch } from '@/lib/shopify/storefront';

export const revalidate = 300;

const ARTICLE_QUERY = `
  query ArticleByHandle($handle: String!) {
    blog(handle: "journal") {
      articleByHandle(handle: $handle) {
        id
        title
        contentHtml
        publishedAt
        authorV2 { name }
        image { url altText }
      }
    }
  }
`;

interface ShopifyArticle {
  id: string;
  title: string;
  contentHtml: string;
  publishedAt: string;
  authorV2: { name: string } | null;
  image: { url: string; altText: string | null } | null;
}

export default async function JournalArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  let article: ShopifyArticle | null = null;

  try {
    const data = await storefrontFetch<{
      blog: { articleByHandle: ShopifyArticle | null } | null;
    }>(ARTICLE_QUERY, { handle: params.slug });
    article = data.blog?.articleByHandle ?? null;
  } catch {
    // fall through to notFound
  }

  if (!article) {
    notFound();
  }

  return (
    <article className="site-container py-12">
      {article.image && (
        <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden mb-8">
          <Image
            src={article.image.url}
            alt={article.image.altText ?? article.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>
      )}
      <h1 className="text-2xl font-medium mb-2">{article.title}</h1>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        {article.authorV2?.name && <span>{article.authorV2.name}</span>}
        <span>·</span>
        <time dateTime={article.publishedAt}>
          {new Date(article.publishedAt).toLocaleDateString('en-CA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
      </div>
      <div
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: article.contentHtml }}
      />
    </article>
  );
}
