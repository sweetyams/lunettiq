'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { JournalArticle } from './page';

const PILLARS = [
  { key: null, label: 'All' },
  { key: 'craft', label: 'The Craft' },
  { key: 'eye', label: 'The Eye' },
  { key: 'face', label: 'The Face' },
  { key: 'house', label: 'The House' },
];

export default function JournalClient({ articles }: { articles: JournalArticle[] }) {
  const [activePillar, setActivePillar] = useState<string | null>(null);

  const filtered = activePillar
    ? articles.filter(a => a.pillar === activePillar)
    : articles;

  return (
    <div className="site-container py-12">
      <h1 className="text-3xl md:text-4xl font-light tracking-wide mb-2">Journal</h1>
      <p className="text-sm text-gray-500 mb-8">Eyewear, craft, culture.</p>

      {/* Pillar filter */}
      <div className="flex gap-2 mb-10 overflow-x-auto pb-2">
        {PILLARS.map(p => (
          <button
            key={p.key ?? 'all'}
            onClick={() => setActivePillar(p.key)}
            className={`px-4 py-2 text-sm rounded-full whitespace-nowrap transition-colors ${
              activePillar === p.key
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-16">No articles yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map(a => (
            <Link key={a.id} href={`/journal/${a.handle}`} className="group">
              <div className="aspect-[16/10] bg-gray-100 rounded-lg overflow-hidden mb-4">
                {a.imageUrl ? (
                  <img
                    src={a.imageUrl}
                    alt={a.imageAlt ?? a.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">◆</div>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                {a.pillar && (
                  <span className="uppercase tracking-wider">
                    {PILLARS.find(p => p.key === a.pillar)?.label ?? a.pillar}
                  </span>
                )}
                {a.pillar && a.readTime && <span>·</span>}
                {a.readTime && <span>{a.readTime} min read</span>}
              </div>
              <h2 className="text-lg font-medium group-hover:underline underline-offset-4 mb-1">
                {a.title}
              </h2>
              {a.excerpt && (
                <p className="text-sm text-gray-500 line-clamp-2">{a.excerpt}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-3">
                {a.author && <span>{a.author}</span>}
                {a.author && <span>·</span>}
                <time dateTime={a.publishedAt}>
                  {new Date(a.publishedAt).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
                </time>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
