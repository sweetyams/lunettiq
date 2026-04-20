import { storefrontFetch } from '@/lib/shopify/storefront';
import JournalClient from './JournalClient';

export const revalidate = 300;

const ARTICLES_QUERY = `
  query JournalArticles {
    blog(handle: "journal") {
      articles(first: 50, sortKey: PUBLISHED_AT, reverse: true) {
        nodes {
          id
          handle
          title
          publishedAt
          image { url altText }
          authorV2 { name }
          pillar: metafield(namespace: "journal", key: "pillar") { value }
          excerpt: metafield(namespace: "journal", key: "excerpt") { value }
          readTime: metafield(namespace: "journal", key: "read_time_minutes") { value }
          authorName: metafield(namespace: "journal", key: "author_name") { value }
          heroImage: metafield(namespace: "journal", key: "hero_image") { reference { ... on MediaImage { image { url altText } } } }
        }
      }
    }
  }
`;

export interface JournalArticle {
  id: string;
  handle: string;
  title: string;
  publishedAt: string;
  imageUrl: string | null;
  imageAlt: string | null;
  author: string | null;
  pillar: string | null;
  excerpt: string | null;
  readTime: number | null;
}

export default async function JournalPage() {
  let articles: JournalArticle[] = [];

  try {
    const data = await storefrontFetch<{
      blog: {
        articles: {
          nodes: Array<{
            id: string;
            handle: string;
            title: string;
            publishedAt: string;
            image: { url: string; altText: string | null } | null;
            authorV2: { name: string } | null;
            pillar: { value: string } | null;
            excerpt: { value: string } | null;
            readTime: { value: string } | null;
            authorName: { value: string } | null;
            heroImage: { reference: { image: { url: string; altText: string | null } } | null } | null;
          }>;
        };
      } | null;
    }>(ARTICLES_QUERY);

    articles = (data.blog?.articles.nodes ?? []).map(a => ({
      id: a.id,
      handle: a.handle,
      title: a.title,
      publishedAt: a.publishedAt,
      imageUrl: a.heroImage?.reference?.image?.url ?? a.image?.url ?? null,
      imageAlt: a.heroImage?.reference?.image?.altText ?? a.image?.altText ?? null,
      author: a.authorName?.value ?? a.authorV2?.name ?? null,
      pillar: a.pillar?.value ?? null,
      excerpt: a.excerpt?.value ?? null,
      readTime: a.readTime?.value ? Number(a.readTime.value) : null,
    }));
  } catch (e) {
    console.error('Journal fetch error:', e);
  }

  return <JournalClient articles={articles} />;
}
