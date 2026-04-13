import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/tryon/prepare
 *
 * Accepts a product image URL and returns metadata about how to use it
 * for virtual try-on. In production, this would integrate with a
 * background-removal service (e.g. remove.bg API, or a Canvas-based
 * approach) to create a clean transparent PNG.
 *
 * For now, it validates the image is accessible and returns the URL
 * with instructions for the try-on overlay. When you have dedicated
 * front-facing frame images, add them as a Shopify metafield
 * (custom.tryon_image) and this route becomes unnecessary.
 *
 * Usage:
 *   POST /api/tryon/prepare
 *   Body: { "imageUrl": "https://cdn.shopify.com/...", "handle": "ada" }
 *   Response: { "tryOnImageUrl": "...", "ready": true }
 */
export async function POST(request: NextRequest) {
  try {
    const { imageUrl, handle } = await request.json();

    if (!imageUrl || !handle) {
      return NextResponse.json({ error: 'Missing imageUrl or handle' }, { status: 400 });
    }

    // Validate the image is accessible
    const head = await fetch(imageUrl, { method: 'HEAD' });
    if (!head.ok) {
      return NextResponse.json({ error: 'Image not accessible' }, { status: 400 });
    }

    // For Shopify CDN images, we can request specific transformations
    // Append _crop_center and resize to a consistent width for try-on
    let tryOnUrl = imageUrl;
    if (imageUrl.includes('cdn.shopify.com')) {
      // Shopify image API: request 800px wide, cropped center
      tryOnUrl = imageUrl.replace(/\.([a-z]+)(\?.*)?$/i, '_800x.$1$2');
    }

    return NextResponse.json({
      tryOnImageUrl: tryOnUrl,
      handle,
      ready: true,
      note: 'For best results, add a front-facing transparent PNG as a Shopify metafield (custom.tryon_image)',
    });
  } catch {
    return NextResponse.json({ error: 'Failed to prepare try-on image' }, { status: 500 });
  }
}
