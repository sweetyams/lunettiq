import type { ImageLoaderProps } from 'next/image';

export default function shopifyImageLoader({ src, width }: ImageLoaderProps): string {
  if (!src.includes('cdn.shopify.com')) return src;
  const url = new URL(src);
  const ext = url.pathname.substring(url.pathname.lastIndexOf('.'));
  const base = url.pathname.substring(0, url.pathname.lastIndexOf('.'));
  return `${url.origin}${base}_${width}x${ext}`;
}
