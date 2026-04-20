'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface Step {
  target: string;
  title: string;
  body: string;
  href?: string;        // navigate here before showing step
  placement?: 'right' | 'bottom';
}

const STEPS: Step[] = [
  { target: 'sidebar-clients', title: 'Clients', body: 'Search, filter, and manage your client database. Click into any client for their full profile, order history, and interactions.', href: '/crm/clients', placement: 'right' },
  { target: 'sidebar-products', title: 'Products', body: 'Browse the full product catalogue synced from Shopify. Check inventory, variants, and pricing.', href: '/crm/products', placement: 'right' },
  { target: 'sidebar-segments', title: 'Segments', body: 'Build dynamic client segments with rules — filter by spend, tags, location, and more.', href: '/crm/segments', placement: 'right' },
  { target: 'sidebar-appointments', title: 'Appointments', body: 'View and manage upcoming appointments. Book fittings, consultations, and follow-ups.', href: '/crm/appointments', placement: 'right' },
  { target: 'sidebar-loyalty', title: 'Loyalty', body: 'Monitor membership tiers, referral funnels, and trial conversions across Essential, CULT, and VAULT.', href: '/crm/loyalty', placement: 'right' },
  { target: 'topbar-search', title: 'Quick Search', body: 'Search clients, products, or orders instantly. You can also press ⌘K to open the command palette.', placement: 'bottom' },
  { target: 'topbar-notifications', title: 'Notifications', body: 'Stay on top of new clients, appointments, and system events. Unread items show a red dot.', placement: 'bottom' },
  { target: 'sidebar-settings', title: 'Settings', body: 'Configure tags, locations, staff roles, loyalty tiers, and view the audit log.', href: '/crm/settings', placement: 'right' },
];

const STORAGE_KEY = 'lunettiq_crm_tour_done';

export default function CrmTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [navigating, setNavigating] = useState(false);

  // Auto-start if not completed
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => setStep(0), 600);
    return () => clearTimeout(t);
  }, []);

  // After navigation completes, re-measure target
  useEffect(() => {
    if (step < 0 || !navigating) return;
    // Wait for page to render after navigation
    const t = setTimeout(() => { setNavigating(false); measure(); }, 300);
    return () => clearTimeout(t);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const measure = useCallback(() => {
    if (step < 0 || step >= STEPS.length) return;
    const el = document.querySelector(`[data-tour="${STEPS[step].target}"]`);
    if (!el) { setRect(null); return; }
    setRect(el.getBoundingClientRect());
  }, [step]);

  // Navigate + measure on step change
  useEffect(() => {
    if (step < 0) return;
    const s = STEPS[step];
    if (s.href && pathname !== s.href) {
      setNavigating(true);
      router.push(s.href);
    } else {
      // Already on the right page, just measure after a tick
      const t = setTimeout(measure, 50);
      return () => clearTimeout(t);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-measure on resize
  useEffect(() => {
    if (step < 0) return;
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [step, measure]);

  const next = () => {
    if (step + 1 >= STEPS.length) { finish(); return; }
    setStep(s => s + 1);
  };

  const prev = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setStep(-1);
    setRect(null);
  };

  if (step < 0 || !rect || navigating) return null;

  const s = STEPS[step];
  const placement = s.placement ?? 'right';
  const gap = 12;

  // Tooltip position
  const tooltipW = 300;
  let top: number, left: number, transform: string;
  if (placement === 'right') {
    top = rect.top + rect.height / 2;
    left = rect.right + gap;
    transform = 'translateY(-50%)';
  } else {
    top = rect.bottom + gap;
    left = Math.min(rect.left + rect.width / 2, window.innerWidth - tooltipW / 2 - 16);
    transform = 'translateX(-50%)';
  }

  // Spotlight cutout via clip-path on the backdrop
  const pad = 4;
  const r = 6;
  const sx = rect.left - pad;
  const sy = rect.top - pad;
  const sw = rect.width + pad * 2;
  const sh = rect.height + pad * 2;
  const clipPath = `polygon(
    0% 0%, 0% 100%, ${sx}px 100%, ${sx}px ${sy}px,
    ${sx + sw}px ${sy}px, ${sx + sw}px ${sy + sh}px,
    ${sx}px ${sy + sh}px, ${sx}px 100%, 100% 100%, 100% 0%
  )`;

  return (
    <>
      {/* Backdrop with spotlight cutout */}
      <div
        onClick={finish}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 10000, clipPath,
        }}
      />

      {/* Spotlight ring around target */}
      <div
        style={{
          position: 'fixed',
          top: sy, left: sx, width: sw, height: sh,
          borderRadius: r,
          boxShadow: '0 0 0 4000px rgba(0,0,0,0.35)',
          zIndex: 10000, pointerEvents: 'none',
        }}
      />

      {/* Tooltip */}
      <div
        style={{
          position: 'fixed', top, left, transform,
          zIndex: 10001, width: 300,
          background: 'var(--crm-surface, #fff)',
          border: '1px solid var(--crm-border, #e5e5e5)',
          borderRadius: 'var(--crm-radius-lg, 10px)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          padding: '16px 18px',
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary, #999)', marginBottom: 6 }}>
          {step + 1} / {STEPS.length}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--crm-text-primary, #111)' }}>
          {s.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--crm-text-secondary, #555)', lineHeight: 1.5, marginBottom: 14 }}>
          {s.body}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={finish}
            style={{ fontSize: 11, color: 'var(--crm-text-tertiary, #999)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            {step > 0 && (
              <button
                onClick={prev}
                style={{
                  fontSize: 13, fontWeight: 500, background: 'var(--crm-surface-hover, #f5f5f5)',
                  color: 'var(--crm-text-secondary, #555)', border: '1px solid var(--crm-border, #e5e5e5)',
                  borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              style={{
                fontSize: 13, fontWeight: 500, background: 'var(--crm-text-primary, #111)',
                color: '#fff', border: 'none', borderRadius: 6,
                padding: '6px 16px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {step + 1 === STEPS.length ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
