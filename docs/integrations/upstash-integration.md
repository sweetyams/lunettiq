# Upstash Redis

**Purpose:** Caching layer for storefront performance (product data, collection data, rate limiting).

## Environment Variables

```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

### Where to Find

1. Go to [console.upstash.com](https://console.upstash.com)
2. Select your Redis database
3. REST API section → copy URL and token

## Usage

Used for caching Shopify Storefront API responses to reduce API calls and improve page load times. Cache invalidation happens via the `/api/revalidate` endpoint triggered by Shopify webhooks.

## Production

Create a separate Upstash database for production. Set env vars in Vercel. Upstash is serverless — no scaling config needed.
