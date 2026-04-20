'use client';

import Link from 'next/link';

interface Props {
  lastOrderDate: string | null;
}

export default function LensRefreshCard({ lastOrderDate }: Props) {
  if (!lastOrderDate) return null;

  const monthsAgo = Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (monthsAgo < 18) return null;

  return (
    <div className="border border-gray-200 rounded-lg p-6 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Your lenses are due for a refresh</p>
        <p className="text-xs text-gray-400 mt-0.5">Last order was {monthsAgo} months ago. Book a 15-minute swap.</p>
      </div>
      <Link
        href="/account/appointments"
        className="shrink-0 px-4 py-2 text-xs border border-black rounded-full hover:bg-black hover:text-white transition-colors"
      >
        Book
      </Link>
    </div>
  );
}
