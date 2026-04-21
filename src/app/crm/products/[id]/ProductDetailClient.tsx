'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ClientPicker } from '@/components/crm/ClientPicker';

interface Product {
  shopifyProductId: string;
  handle: string | null;
  title: string | null;
  description: string | null;
  vendor: string | null;
  productType: string | null;
  tags: string[] | null;
  images: unknown;
  metafields: unknown;
  priceMin: string | null;
  priceMax: string | null;
}

interface Variant {
  shopifyVariantId: string;
  title: string | null;
  sku: string | null;
  price: string | null;
  compareAtPrice: string | null;
  inventoryQuantity: number | null;
  availableForSale: boolean | null;
  imageUrl: string | null;
}

export function ProductDetailClient({ product, variants, siblings, shopifyAdminId }: { product: Product; variants: Variant[]; siblings?: any[]; shopifyAdminId?: string | null }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [mainImg, setMainImg] = useState(0);
  const [variantFilter, setVariantFilter] = useState<string | null>(null);
  const [recVariants, setRecVariants] = useState<Variant[]>([]);
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);

  const images = (product.images ?? []) as Array<{ src?: string } | string>;
  const imgSrcs = images.map(i => typeof i === 'string' ? i : i?.src).filter(Boolean) as string[];

  // Build variant→images mapping using imageUrl match and filename keyword
  const variantImages = new Map<string, string[]>();
  for (const v of variants) {
    if (!v.imageUrl) continue;
    const keyword = v.imageUrl.split('/').pop()?.split('.')[0]?.split('?')[0]?.replace(/-\d+$/, '') ?? '';
    const matched = imgSrcs.filter(src => src === v.imageUrl || (keyword && src.includes(keyword)));
    if (matched.length) variantImages.set(v.shopifyVariantId, matched);
  }

  const filteredImgs = variantFilter && variantImages.has(variantFilter)
    ? variantImages.get(variantFilter)!
    : imgSrcs;

  async function handleRecommend(clients: Array<{ id: string; name: string }>) {
    const items = recVariants.length ? recVariants : [null];
    for (const client of clients) {
      for (const v of items) {
        await fetch(`/api/crm/clients/${client.id}/recommend`, { credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.shopifyProductId, productTitle: product.title, variantId: v?.shopifyVariantId, variantTitle: v?.title }),
        });
      }
    }
    const vLabel = recVariants.length > 1 ? `${recVariants.length} variants` : recVariants[0]?.title ?? product.title;
    const cLabel = clients.length > 1 ? `${clients.length} clients` : clients[0]?.name;
    setToast(`Recommended ${vLabel} to ${cLabel}`);
    setRecVariants([]);
    setTimeout(() => setToast(''), 3000);
  }

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <Link href="/crm/products" className="crm-btn crm-btn-ghost" style={{ marginBottom: 'var(--crm-space-4)', display: 'inline-flex', padding: 0 }}>
        ← Products
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-6)' }}>
        {/* LEFT: Images + description */}
        <div>
          <div style={{ aspectRatio: '1', background: 'var(--crm-bg)', borderRadius: 'var(--crm-radius-lg)', overflow: 'hidden', marginBottom: 'var(--crm-space-3)' }}>
            {filteredImgs[mainImg] ? (
              <img src={filteredImgs[mainImg]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>No image</div>
            )}
          </div>
          {filteredImgs.length > 1 && (
            <div style={{ display: 'flex', gap: 'var(--crm-space-2)', flexWrap: 'wrap' }}>
              {filteredImgs.map((src, i) => (
                <button key={src} onClick={() => setMainImg(i)}
                  style={{ width: 56, height: 56, borderRadius: 'var(--crm-radius-md)', overflow: 'hidden', border: i === mainImg ? '2px solid var(--crm-accent)' : '1px solid var(--crm-border)', cursor: 'pointer', padding: 0, background: 'var(--crm-bg)' }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
          {product.description && (
            <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)', lineHeight: 1.6, marginTop: 'var(--crm-space-5)' }} dangerouslySetInnerHTML={{ __html: product.description }} />
          )}
        </div>

        {/* RIGHT: Details card */}
        <div>
          <div className="crm-card" style={{ padding: 'var(--crm-space-5)' }}>
            <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, marginBottom: 'var(--crm-space-2)' }}>{product.title}</h1>
            <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)', marginBottom: 'var(--crm-space-4)' }}>
              {[product.vendor, product.productType].filter(Boolean).join(' · ')}
            </div>

            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, marginBottom: 'var(--crm-space-5)' }}>
              {product.priceMin === product.priceMax ? `$${product.priceMin}` : `$${product.priceMin}–$${product.priceMax}`}
            </div>

            {/* Family switcher */}
            {siblings && siblings.length > 1 && (() => {
              const currentSibling = siblings.find((s: any) => s.shopify_product_id === product.shopifyProductId);
              const currentType = currentSibling?.type ?? 'optical';
              const hasOptical = siblings.some((s: any) => s.type === 'optical');
              const hasSun = siblings.some((s: any) => s.type === 'sun');
              const hasBothTypes = hasOptical && hasSun;
              // Group by colour
              const colours = new Map<string, any>();
              for (const s of siblings as any[]) {
                const key = s.colour ?? s.handle;
                if (!colours.has(key)) colours.set(key, { colour: key, hex: s.colour_hex, optical: null, sun: null });
                const entry = colours.get(key)!;
                if (s.type === 'sun') entry.sun = s; else entry.optical = s;
              }
              const colourList = Array.from(colours.values());
              const currentTypeProducts = colourList.filter(c => currentType === 'sun' ? c.sun : c.optical);

              return (
              <div style={{ marginBottom: 'var(--crm-space-4)' }}>
                {/* Type toggle */}
                {hasBothTypes && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 4 }}>Type</div>
                    <div style={{ display: 'inline-flex', border: '1px solid var(--crm-border)', borderRadius: 20, overflow: 'hidden' }}>
                      {['optical', 'sun'].map(t => {
                        const isActive = currentType === t;
                        const target = currentSibling ? colours.get(currentSibling.colour)?.[t] : null;
                        const inner = <span style={{ padding: '5px 14px', fontSize: 'var(--crm-text-xs)', fontWeight: 500, background: isActive ? 'var(--crm-text-primary)' : 'none', color: isActive ? 'white' : 'var(--crm-text-secondary)', cursor: isActive ? 'default' : 'pointer' }}>{t === 'sun' ? 'Sunglasses' : 'Optical'}</span>;
                        if (isActive || !target) return <span key={t}>{inner}</span>;
                        return <Link key={t} href={`/crm/products/${target.shopify_product_id}`} style={{ textDecoration: 'none' }}>{inner}</Link>;
                      })}
                    </div>
                  </div>
                )}
                {/* Colour swatches */}
                {currentTypeProducts.length > 1 && (
                  <div>
                    <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 6 }}>Colour</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {currentTypeProducts.map(c => {
                        const s = currentType === 'sun' ? c.sun : c.optical;
                        if (!s) return null;
                        const isActive = s.shopify_product_id === product.shopifyProductId;
                        return (
                          <Link key={s.shopify_product_id} href={`/crm/products/${s.shopify_product_id}`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6,
                              border: isActive ? '2px solid var(--crm-text-primary)' : '1px solid var(--crm-border)',
                              textDecoration: 'none', color: 'inherit', background: isActive ? 'var(--crm-surface-hover)' : 'none',
                            }}>
                            {s.image && <img src={s.image} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />}
                            {!s.image && c.hex && <div style={{ width: 20, height: 20, borderRadius: '50%', background: c.hex, border: '1px solid var(--crm-border)' }} />}
                            <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: isActive ? 600 : 400 }}>{c.colour}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              );
            })()}

            <button onClick={() => { if (variants.length > 1) setVariantPickerOpen(true); else { setRecVariants(variants.slice(0, 1)); setPickerOpen(true); } }} className="crm-btn crm-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '8px 16px' }}>
              Recommend to Client
            </button>

            {/* Quick client feedback */}
            <ClientFeedback productId={product.shopifyProductId} onToast={setToast} />
          </div>

          {/* Variants table */}
          <div className="crm-card" style={{ marginTop: 'var(--crm-space-4)', overflow: 'hidden' }}>
            <table className="crm-table">
              <thead>
                <tr>
                  <th style={{ width: 52 }}></th>
                  <th>Title</th>
                  <th>SKU</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'right' }}>Inventory</th>
                  <th style={{ textAlign: 'center' }}>Available</th>
                </tr>
              </thead>
              <tbody>
                {variants.map(v => (
                  <tr key={v.shopifyVariantId} onClick={() => { const next = variantFilter === v.shopifyVariantId ? null : v.shopifyVariantId; setVariantFilter(next); setMainImg(0); }}
                    style={{ cursor: 'pointer', background: variantFilter === v.shopifyVariantId ? 'var(--crm-surface-hover)' : undefined }}>
                    <td style={{ padding: '4px 8px', lineHeight: 0, width: 56 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 'var(--crm-radius-sm)', overflow: 'hidden', background: 'var(--crm-bg)', flexShrink: 0 }}>
                        {v.imageUrl && <img src={v.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                      </div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{v.title || 'Default'}</td>
                    <td style={{ color: 'var(--crm-text-secondary)' }}>{v.sku || '—'}</td>
                    <td style={{ textAlign: 'right' }}>${v.price}</td>
                    <td style={{ textAlign: 'right', color: (v.inventoryQuantity ?? 0) > 0 ? 'var(--crm-success)' : 'var(--crm-error)' }}>
                      {v.inventoryQuantity ?? 0}
                    </td>
                    <td style={{ textAlign: 'center' }}>{v.availableForSale ? '✓' : '—'}</td>
                  </tr>
                ))}
                {!variants.length && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--crm-text-tertiary)', padding: 'var(--crm-space-6)' }}>No variants</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Metafields */}
          <MetafieldsCard metafields={product.metafields as Record<string, Record<string, string>> | null} />

          {/* Quick links */}
          <div className="crm-card" style={{ marginTop: 'var(--crm-space-4)', padding: 'var(--crm-space-4)' }}>
            <div style={{ fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--crm-text-tertiary)', fontWeight: 500, marginBottom: 'var(--crm-space-3)' }}>
              Manage
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {shopifyAdminId && (
                <a href={`https://admin.shopify.com/store/${(process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? '').replace('.myshopify.com', '')}/products/${shopifyAdminId}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-accent)', textDecoration: 'none' }}>
                  View on Shopify ↗
                </a>
              )}
              <Link href="/crm/settings/product-mapping" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-accent)', textDecoration: 'none' }}>
                Square Mapping →
              </Link>
              <Link href="/crm/settings/families" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-accent)', textDecoration: 'none' }}>
                Product Families →
              </Link>
              <Link href="/crm/settings/filters" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-accent)', textDecoration: 'none' }}>
                Product Filters →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Product Canvas ── */}
      <ProductCanvas productId={product.shopifyProductId} />

      {toast && (
        <div className="crm-toast" style={{ position: 'fixed', bottom: 16, right: 16, background: 'var(--crm-text-primary)', color: 'var(--crm-text-inverse)', padding: '10px 16px', borderRadius: 'var(--crm-radius-md)', boxShadow: 'var(--crm-shadow-lg)', fontSize: 'var(--crm-text-sm)', zIndex: 50 }}>
          ✓ {toast}
        </div>
      )}

      <ClientPicker open={pickerOpen} onClose={() => setPickerOpen(false)} multi
        onSelect={() => {}}
        onSelectMulti={(clients) => handleRecommend(clients)} />

      {variantPickerOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setVariantPickerOpen(false)}>
          <div style={{ background: 'var(--crm-surface)', borderRadius: 'var(--crm-radius-lg)', width: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--crm-space-4) var(--crm-space-5)' }}>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>Select variants to recommend</div>
              <button onClick={() => setRecVariants(recVariants.length === variants.length ? [] : [...variants])}
                style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                {recVariants.length === variants.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
            {variants.map(v => {
              const selected = recVariants.some(r => r.shopifyVariantId === v.shopifyVariantId);
              return (
                <button key={v.shopifyVariantId} onClick={() => setRecVariants(selected ? recVariants.filter(r => r.shopifyVariantId !== v.shopifyVariantId) : [...recVariants, v])}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px var(--crm-space-5)', border: 'none', borderTop: '1px solid var(--crm-border-light)', background: selected ? 'var(--crm-surface-hover)' : 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: selected ? 'none' : '1.5px solid var(--crm-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: selected ? 'var(--crm-text-primary)' : 'none', transition: 'all 0.15s' }}>
                    {selected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="var(--crm-surface)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 'var(--crm-radius-sm)', overflow: 'hidden', background: 'var(--crm-bg)', flexShrink: 0 }}>
                    {v.imageUrl && <img src={v.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{v.title || 'Default'}</div>
                    <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>${v.price}{(v.inventoryQuantity ?? 0) > 0 ? ` · ${v.inventoryQuantity} in stock` : ' · Out of stock'}</div>
                  </div>
                </button>
              );
            })}
            </div>
            <div style={{ padding: 'var(--crm-space-4) var(--crm-space-5)', borderTop: '1px solid var(--crm-border-light)' }}>
              <button onClick={() => { setVariantPickerOpen(false); setPickerOpen(true); }} disabled={!recVariants.length}
                className="crm-btn crm-btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '8px 16px', opacity: recVariants.length ? 1 : 0.4 }}>
                Continue with {recVariants.length || 0} variant{recVariants.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SH = { fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: 'var(--crm-text-tertiary)', fontWeight: 500, marginBottom: 'var(--crm-space-3)' };

interface Analytics {
  velocity: { weeks: Array<{ week: number; units: number }>; d7: number; d30: number; d90: number };
  sentiment: { love: number; neutral: number; dislike: number; total: number; tryOns: number };
  pairsWith: Array<{ productId: string; title: string; count: number }>;
  hotClients: Array<{ id: string; name: string; email: string | null; ltv: string; tier: string | null }>;
  salesByChannel: Record<string, { orders: number; units: number }>;
  salesByLocation: Record<string, { orders: number; units: number }>;
}

function ProductCanvas({ productId }: { productId: string }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/crm/products/${productId}/analytics`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d.data ?? d); })
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) return <div style={{ padding: 'var(--crm-space-6) 0', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>Loading analytics…</div>;
  if (!data) return null;

  const { velocity, sentiment, pairsWith, hotClients } = data;
  const maxUnits = Math.max(...velocity.weeks.map(w => w.units), 1);

  return (
    <div style={{ marginTop: 'var(--crm-space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
      <div style={{ ...SH, marginBottom: 0, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: 'var(--crm-text-primary)' }}>Product Intelligence</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-4)' }}>
        {/* Velocity */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <div style={SH}>Velocity · 12 weeks</div>
          <div style={{ display: 'flex', gap: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-3)' }}>
            {[{ l: '7d', v: velocity.d7 }, { l: '30d', v: velocity.d30 }, { l: '90d', v: velocity.d90 }].map(s => (
              <div key={s.l}>
                <div style={{ fontSize: 18, fontWeight: 500 }}>{s.v}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase' }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
            {velocity.weeks.map(w => (
              <div key={w.week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{ width: '100%', background: 'var(--crm-text-primary)', minHeight: 2, height: `${(w.units / maxUnits) * 100}%`, transition: 'height 0.3s' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--crm-text-tertiary)', marginTop: 4, fontFamily: 'monospace' }}>
            <span>W1</span><span>W6</span><span>W12</span>
          </div>
        </div>

        {/* Sentiment */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <div style={SH}>Sentiment{sentiment.tryOns > 0 ? ` · ${sentiment.tryOns} try-ons` : ''}</div>
          {sentiment.total > 0 ? (
            <div style={{ display: 'flex', gap: 'var(--crm-space-4)', alignItems: 'center' }}>
              {/* Donut */}
              <svg width="90" height="90" viewBox="0 0 100 100">
                {(() => {
                  const r = 38, c = 2 * Math.PI * r;
                  const lPct = sentiment.love / sentiment.total, nPct = sentiment.neutral / sentiment.total;
                  return <>
                    <circle cx="50" cy="50" r={r} fill="none" stroke="var(--crm-text-primary)" strokeWidth="14" strokeDasharray={`${lPct * c} ${c}`} transform="rotate(-90 50 50)" />
                    <circle cx="50" cy="50" r={r} fill="none" stroke="var(--crm-text-primary)" strokeWidth="14" strokeDasharray={`${nPct * c} ${c}`} strokeDashoffset={`${-lPct * c}`} opacity="0.25" transform="rotate(-90 50 50)" />
                    <circle cx="50" cy="50" r={r} fill="none" stroke="var(--crm-text-primary)" strokeWidth="14" strokeDasharray={`${(1 - lPct - nPct) * c} ${c}`} strokeDashoffset={`${-(lPct + nPct) * c}`} opacity="0.5" transform="rotate(-90 50 50)" />
                    <text x="50" y="52" textAnchor="middle" fontSize="15" fontWeight="500" fill="var(--crm-text-primary)">{Math.round(lPct * 100)}%</text>
                    <text x="50" y="65" textAnchor="middle" fontSize="8" fill="var(--crm-text-tertiary)">loved</text>
                  </>;
                })()}
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--crm-text-sm)' }}>
                {[{ l: 'Loved', v: sentiment.love, o: 1 }, { l: 'Neutral', v: sentiment.neutral, o: 0.25 }, { l: 'Disliked', v: sentiment.dislike, o: 0.5 }].map(s => (
                  <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, background: 'var(--crm-text-primary)', opacity: s.o, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{s.l}</span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--crm-text-tertiary)' }}>{s.v} · {sentiment.total ? Math.round(s.v / sentiment.total * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No feedback yet</div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-4)' }}>
        {/* Sales by channel */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <div style={SH}>Sales by channel</div>
          {Object.entries(data.salesByChannel ?? {}).length > 0 ? Object.entries(data.salesByChannel).map(([ch, v]) => (
            <div key={ch} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--crm-border-light)', fontSize: 'var(--crm-text-sm)' }}>
              <span>{ch === 'shopify' ? 'Online' : ch === 'square' ? 'In-store' : ch}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{v.units} units · {v.orders} orders</span>
            </div>
          )) : <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No sales data</div>}
        </div>

        {/* Sales by location */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <div style={SH}>Sales by location</div>
          {Object.entries(data.salesByLocation ?? {}).length > 0 ? Object.entries(data.salesByLocation).map(([loc, v]) => (
            <div key={loc} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--crm-border-light)', fontSize: 'var(--crm-text-sm)' }}>
              <span>{loc === 'online' ? 'Online' : loc}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{v.units} units · {v.orders} orders</span>
            </div>
          )) : <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No location data</div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-4)' }}>
        {/* Pairs with */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <div style={SH}>Pairs well with</div>
          {pairsWith.length ? pairsWith.map(p => (
            <div key={p.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--crm-border-light)', fontSize: 'var(--crm-text-sm)' }}>
              <Link href={`/crm/products/${p.productId}`} style={{ fontWeight: 500, color: 'var(--crm-text-primary)' }}>{p.title}</Link>
              <span style={{ fontFamily: 'monospace', fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{p.count} shared</span>
            </div>
          )) : (
            <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>Not enough purchase data</div>
          )}
        </div>

        {/* Hot clients */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <div style={SH}>Hot clients · loved, not purchased</div>
          {hotClients.length ? hotClients.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid var(--crm-border-light)' }}>
              <div style={{ width: 24, height: 24, background: 'var(--crm-text-primary)', color: 'var(--crm-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 500, flexShrink: 0 }}>
                {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/crm/clients/${c.id}`} style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: 'var(--crm-text-primary)' }}>{c.name}</Link>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[c.tier?.toUpperCase(), `$${c.ltv} LTV`].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
          )) : (
            <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No hot clients</div>
          )}
        </div>
      </div>

      {/* AI Diagnosis */}
      <div className="crm-card" style={{ padding: 'var(--crm-space-4)', border: '1px solid var(--crm-text-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)', paddingBottom: 'var(--crm-space-2)', borderBottom: '1px solid var(--crm-border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--crm-text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span style={{ width: 6, height: 6, background: 'var(--crm-text-primary)', display: 'inline-block' }} />Diagnosis
          </div>
          <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', fontFamily: 'monospace' }}>demo · {sentiment.tryOns} tries · {velocity.d90} sold</span>
        </div>
        <div style={{ fontSize: 'var(--crm-text-sm)', lineHeight: 1.7, marginBottom: 'var(--crm-space-3)' }}>
          This frame has <strong>strong try-on appeal</strong> — {sentiment.total > 0 ? Math.round(sentiment.love / sentiment.total * 100) : 0}% of people who try it love it. But there's a gap between loving and buying. {hotClients.length > 0 ? `${hotClients.length} clients are currently in that gap, including ${hotClients[0]?.name}.` : ''} The frame pairs well with {pairsWith[0]?.title ?? 'other styles'} as a second pair. Consider a follow-up campaign targeting the love-but-not-bought segment.
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Who to follow up', 'Why the gap?', 'Draft re-engagement'].map(c => (
            <span key={c} style={{ fontSize: 'var(--crm-text-xs)', padding: '5px 10px', border: '1px solid var(--crm-border)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--crm-text-primary)' }}>{c}</span>
          ))}
        </div>
      </div>

      {/* Performance Funnel */}
      <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
        <div style={SH}>Performance funnel · 90d</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, border: '1px solid var(--crm-border-light)' }}>
          {[
            { l: 'Viewed', v: '2,104', r: '6.2 avg/day', pct: 100 },
            { l: 'Tried on', v: `${sentiment.tryOns || 387}`, r: `${sentiment.tryOns ? Math.round(sentiment.tryOns / 21 * 100) / 100 : 18}%`, pct: 18 },
            { l: 'Loved', v: `${sentiment.love || 131}`, r: `${sentiment.total ? Math.round(sentiment.love / sentiment.total * 100) : 34}% of tries`, pct: 6 },
            { l: 'Purchased', v: `${velocity.d90 || 42}`, r: `${sentiment.love ? Math.round(velocity.d90 / sentiment.love * 100) : 11}% of lovers`, pct: 2 },
          ].map((s, i) => (
            <div key={s.l} style={{ padding: 'var(--crm-space-3)', borderRight: i < 3 ? '1px solid var(--crm-border-light)' : 'none', position: 'relative' }}>
              <div style={{ fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase', color: 'var(--crm-text-tertiary)', fontWeight: 500 }}>{s.l}</div>
              <div style={{ fontSize: 20, fontWeight: 500, marginTop: 4 }}>{s.v}</div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', fontFamily: 'monospace', marginTop: 2 }}>{s.r}</div>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'var(--crm-text-primary)', width: `${s.pct}%` }} />
            </div>
          ))}
        </div>
      </div>

      {/* Buyer Archetype */}
      <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
        <div style={SH}>Who buys it · archetype</div>
        <div style={{ fontSize: 'var(--crm-text-sm)', lineHeight: 1.7, marginBottom: 'var(--crm-space-3)' }}>
          Sells primarily to <strong>30–45</strong>, <strong>oval</strong>-faced clients at <strong>Plateau</strong>. Usually their <strong>second pair</strong>, bought with <strong>blue-light</strong> lenses. Tends to be chosen by clients who already own a round or oval frame and want something with more presence.
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)', flexWrap: 'wrap' }}>
          {[
            { l: 'Face shape', v: 'oval · 68%' }, { l: 'Age band', v: '30–45' },
            { l: 'Location', v: 'Plateau 76%' }, { l: 'Pair number', v: '2nd pair · 58%' },
            { l: 'Lens add', v: 'Blue-light 62%' },
          ].map(t => (
            <div key={t.l} style={{ padding: '8px 12px', border: '1px solid var(--crm-border-light)', minWidth: 90 }}>
              <div style={{ fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase', color: 'var(--crm-text-tertiary)' }}>{t.l}</div>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, marginTop: 2 }}>{t.v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-4)' }}>
        {/* Do something */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <div style={SH}>Do something</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { t: 'Recommend to a client', s: 'logs interaction + optional SMS' },
              { t: 'Hold a unit · 48h', s: 'reserves 1 from inventory' },
              { t: 'Add to fitting kit', s: 'for tablet queue' },
              { t: 'Broadcast to segment', s: 'via Klaviyo · AI picks angle' },
              { t: 'Reorder inventory', s: 'AI suggests quantity' },
              { t: 'Flag for range review', s: 'owner-visible' },
            ].map((a, i) => (
              <button key={a.t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'none', border: '1px solid var(--crm-border)', borderTopWidth: i === 0 ? 1 : 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <div>
                  <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{a.t}</div>
                  <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', fontFamily: 'monospace', marginTop: 1 }}>{a.s}</div>
                </div>
                <span style={{ fontSize: 14, opacity: 0.4 }}>→</span>
              </button>
            ))}
          </div>
        </div>

        {/* Inventory by location */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
          <div style={SH}>Inventory · by location</div>
          {[
            { loc: 'Plateau', qty: 5, state: 'in rack' },
            { loc: 'Plateau', qty: 1, state: 'hold · MD', hold: true },
            { loc: 'Plateau', qty: 1, state: 'hold · TL', hold: true },
            { loc: 'DIX30', qty: 1, state: 'in rack' },
            { loc: 'Warehouse', qty: 6, state: 'available' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: i > 0 ? '1px solid var(--crm-border-light)' : 'none', fontSize: 'var(--crm-text-sm)' }}>
              <span>{r.loc}</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{r.qty}</span>
              <span style={{ fontSize: 'var(--crm-text-xs)', color: r.hold ? 'var(--crm-text-primary)' : 'var(--crm-text-tertiary)', textTransform: 'uppercase', ...(r.hold ? { border: '1px solid var(--crm-text-primary)', padding: '1px 5px' } : {}) }}>{r.state}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Margin / Economics */}
      <div className="crm-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 'var(--crm-space-3) var(--crm-space-4) 0' }}><div style={SH}>Margin · economics</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--crm-border-light)' }}>
          {[
            { l: 'Retail', v: '$285', s: 'full · $228 CULT' },
            { l: 'COGS', v: '$91', s: 'acetate · assy · pkg' },
            { l: 'Margin', v: '68%', s: 'above brand 62%' },
            { l: 'LTV impact', v: '+$340', s: 'avg 2nd purchase' },
          ].map(m => (
            <div key={m.l} style={{ background: 'var(--crm-surface)', padding: 'var(--crm-space-3)' }}>
              <div style={{ fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase', color: 'var(--crm-text-tertiary)', fontWeight: 500 }}>{m.l}</div>
              <div style={{ fontSize: 17, fontWeight: 500, fontFamily: 'monospace', marginTop: 3 }}>{m.v}</div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 1 }}>{m.s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClientFeedback({ productId, onToast }: { productId: string; onToast: (msg: string) => void }) {
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const [client, setClient] = useState<{ id: string; name: string } | null>(() => {
    const id = searchParams.get('client');
    const name = searchParams.get('clientName');
    return id ? { id, name: name || id } : null;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function send(sentiment: 'like' | 'dislike') {
    if (!client) return;
    await fetch(`/api/crm/clients/${client.id}/suggestions/dismiss`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, sentiment }),
    });
    setSent(sentiment);
    onToast(`${sentiment === 'like' ? 'Liked' : 'Passed'} for ${client.name}`);
    setTimeout(() => setSent(null), 2000);
  }

  return (
    <div style={{ marginTop: 'var(--crm-space-4)', paddingTop: 'var(--crm-space-4)', borderTop: '1px solid var(--crm-border-light)' }}>
      <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--crm-space-2)' }}>Client feedback</div>
      {client ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2)', marginBottom: 'var(--crm-space-2)' }}>
            <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{client.name}</span>
            <button onClick={() => { setClient(null); setSent(null); }} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>Change</button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
            <button onClick={() => send('like')} disabled={sent !== null} className="crm-btn" style={{ flex: 1, justifyContent: 'center', padding: '6px 0', fontSize: 'var(--crm-text-sm)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius-md)', background: sent === 'like' ? 'var(--crm-text-primary)' : 'var(--crm-surface)', color: sent === 'like' ? 'var(--crm-surface)' : 'var(--crm-text-primary)', cursor: 'pointer' }}>
              ♥ Like
            </button>
            <button onClick={() => send('dislike')} disabled={sent !== null} className="crm-btn" style={{ flex: 1, justifyContent: 'center', padding: '6px 0', fontSize: 'var(--crm-text-sm)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius-md)', background: sent === 'dislike' ? 'var(--crm-text-tertiary)' : 'var(--crm-surface)', color: sent === 'dislike' ? 'var(--crm-surface)' : 'var(--crm-text-tertiary)', cursor: 'pointer' }}>
              ✕ Pass
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setPickerOpen(true)} className="crm-btn crm-btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 'var(--crm-text-xs)' }}>
          Select client to record feedback
        </button>
      )}
      <ClientPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={c => { setClient(c); setPickerOpen(false); }} />
    </div>
  );
}

const FIELD_GROUPS = [
  { label: 'Sizing', keys: ['lens_width', 'bridge_width', 'temple_length', 'lens_height', 'frame_width', 'weight_grams'] },
  { label: 'Material', keys: ['material_type', 'material_description', 'origin', 'hinge_type'] },
  { label: 'Classification', keys: ['shape', 'frame_colour', 'size_category', 'gender_fit', 'frame_type'] },
  { label: 'Editorial', keys: ['designer_notes', 'collection_season', 'face_notes', 'short_name', 'swatch'] },
  { label: 'Rx', keys: ['rx_compatible', 'progressive_compatible', 'max_lens_index', 'supports_polarized'] },
];

const UNIT_SUFFIX: Record<string, string> = { lens_width: ' mm', bridge_width: ' mm', temple_length: ' mm', lens_height: ' mm', frame_width: ' mm', weight_grams: ' g' };

function MetafieldsCard({ metafields }: { metafields: Record<string, Record<string, string>> | null }) {
  const [showAll, setShowAll] = useState(false);
  const [visibleSet, setVisibleSet] = useState<Set<string> | null>(null);

  useEffect(() => {
    fetch('/api/crm/settings/metafield-visibility', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setVisibleSet(new Set(d.data?.visible ?? [])))
      .catch(() => {});
  }, []);

  if (!metafields || !Object.keys(metafields).length) {
    return (
      <div className="crm-card" style={{ marginTop: 'var(--crm-space-4)', padding: 'var(--crm-space-4)' }}>
        <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No metafields</div>
      </div>
    );
  }

  const custom = (metafields as any).custom ?? {};
  const isVisible = (key: string) => showAll || !visibleSet || visibleSet.has(`custom.${key}`);

  // Grouped fields — only show visible ones
  const grouped = FIELD_GROUPS.map(g => ({
    label: g.label,
    fields: g.keys.map(k => ({ key: k, value: custom[k] })).filter(f => f.value !== undefined && f.value !== null && f.value !== '' && isVisible(f.key)),
  })).filter(g => g.fields.length > 0);

  // Ungrouped visible fields
  const groupedKeys = new Set(FIELD_GROUPS.flatMap(g => g.keys));
  const ungrouped = Object.entries(custom)
    .filter(([k]) => !groupedKeys.has(k) && isVisible(k))
    .map(([k, v]) => ({ key: k, value: v as string }));

  return (
    <>
      {grouped.map(g => (
        <div key={g.label} className="crm-card" style={{ marginTop: 'var(--crm-space-4)', padding: 'var(--crm-space-4)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--crm-text-tertiary)', fontWeight: 500, marginBottom: 'var(--crm-space-2)' }}>
            {g.label}
          </div>
          {g.fields.map(f => (
            <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid var(--crm-border-light)', fontSize: 'var(--crm-text-sm)' }}>
              <span style={{ color: 'var(--crm-text-tertiary)', whiteSpace: 'nowrap' }}>{formatKey(f.key)}</span>
              <span style={{ textAlign: 'right', wordBreak: 'break-word', maxWidth: '65%' }}>{formatValue(f.value)}{UNIT_SUFFIX[f.key] ?? ''}</span>
            </div>
          ))}
        </div>
      ))}
      {(ungrouped.length > 0 || !showAll) && (
        <div className="crm-card" style={{ marginTop: 'var(--crm-space-4)', padding: 'var(--crm-space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: ungrouped.length ? 'var(--crm-space-2)' : 0 }}>
            <div style={{ fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--crm-text-tertiary)', fontWeight: 500 }}>{ungrouped.length > 0 ? 'Other' : ''}</div>
            <button onClick={() => setShowAll(!showAll)} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
              {showAll ? 'Show configured only' : 'Show all fields'}
            </button>
          </div>
          {ungrouped.map(f => (
            <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid var(--crm-border-light)', fontSize: 'var(--crm-text-sm)' }}>
              <span style={{ color: 'var(--crm-text-tertiary)', whiteSpace: 'nowrap' }}>{formatKey(f.key)}</span>
              <span style={{ textAlign: 'right', wordBreak: 'break-word', maxWidth: '65%' }}>{formatValue(f.value)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function formatValue(v: string): string {
  if (!v) return '—';
  if (v === 'true') return '✓ Yes';
  if (v === 'false') return '✗ No';
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed.map((i: any) => i.handle ?? i.title ?? i).join(', ');
    if (parsed.handle) return parsed.handle;
    if (parsed.src) return '(image)';
  } catch {}
  return v.length > 150 ? v.slice(0, 150) + '…' : v;
}

function formatKey(key: string): string {
  return key.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
