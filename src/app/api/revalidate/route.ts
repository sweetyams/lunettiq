import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET;

export async function POST(request: NextRequest) {
  // Verify secret token
  const secret = request.headers.get('x-revalidation-secret') ?? request.nextUrl.searchParams.get('secret');

  if (!REVALIDATION_SECRET || secret !== REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, handle, tag } = body as {
      type?: string;
      handle?: string;
      tag?: string;
    };

    // Revalidate by tag if provided
    if (tag) {
      revalidateTag(tag);
      return NextResponse.json({ revalidated: true, tag });
    }

    // Revalidate by type + handle
    const paths: string[] = [];

    switch (type) {
      case 'product':
        if (handle) paths.push(`/products/${handle}`);
        paths.push('/'); // homepage may show product rows
        break;
      case 'collection':
        if (handle) paths.push(`/collections/${handle}`);
        paths.push('/'); // homepage may show collection panels
        break;
      case 'page':
        if (handle) paths.push(`/pages/${handle}`);
        break;
      case 'article':
        if (handle) paths.push(`/journal/${handle}`);
        break;
      case 'metaobject':
        // Revalidate homepage and stores for metaobject changes
        paths.push('/');
        paths.push('/pages/stores');
        break;
      default:
        // Revalidate homepage as fallback
        paths.push('/');
    }

    for (const path of paths) {
      revalidatePath(path);
    }

    return NextResponse.json({ revalidated: true, paths });
  } catch {
    return NextResponse.json({ error: 'Failed to revalidate' }, { status: 500 });
  }
}
