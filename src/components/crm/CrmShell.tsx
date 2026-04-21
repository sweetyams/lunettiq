'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { CrmSidebar } from './CrmSidebar';
import { GlobalSearch } from './GlobalSearch';
import { CommandPalette } from './CommandPalette';
import CrmTour from './CrmTour';
import Link from 'next/link';

interface Toast { id: number; message: string; type: 'success' | 'error' }
interface ToastCtx { toast: (message: string, type?: 'success' | 'error') => void }
interface Notification { id: string; title: string; body: string | null; type: string; entityType: string | null; entityId: string | null; readAt: string | null; createdAt: string }
const ToastContext = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch('/api/crm/notifications', { credentials: 'include' });
      if (res.ok) { const d = await res.json(); const data = d.data ?? d; setNotifs(data.notifications ?? []); setUnreadCount(data.unreadCount ?? 0); }
    } catch {}
  }, []);

  useEffect(() => { fetchNotifs(); const i = setInterval(fetchNotifs, 30000); return () => clearInterval(i); }, [fetchNotifs]);

  async function markAllRead() {
    await fetch('/api/crm/notifications', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: 'all' }) });
    setUnreadCount(0);
    setNotifs(n => n.map(x => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
  }

  const toast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <div className="crm-root flex h-screen overflow-hidden">
        <CrmSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header
            className="h-11 flex items-center px-4 gap-3 shrink-0"
            style={{ borderBottom: '1px solid var(--crm-border)', background: 'var(--crm-surface)' }}
          >
            <button
              onClick={() => setSearchOpen(true)}
              data-tour="topbar-search"
              className="crm-btn-ghost flex items-center gap-2 text-xs"
              style={{ color: 'var(--crm-text-tertiary)', padding: '4px 10px', borderRadius: 'var(--crm-radius-md)', border: '1px solid var(--crm-border)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              Search…
              <kbd style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', background: 'var(--crm-bg)', padding: '1px 5px', borderRadius: 3, border: '1px solid var(--crm-border-light)' }}>⌘K</kbd>
            </button>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--crm-border)', textDecoration: 'none', color: 'var(--crm-text-secondary)', fontSize: 11, fontWeight: 500, transition: 'border-color 150ms var(--ease-out)' }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 0 2px rgba(22,163,74,0.2)' }} />
              Storefront
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
            <div style={{ flex: 1 }} />
            {/* Notification bell */}
            <div style={{ position: 'relative' }} data-tour="topbar-notifications">
              <button onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) fetchNotifs(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, position: 'relative', color: 'var(--crm-text-tertiary)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {unreadCount > 0 && <span style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: 4, background: 'var(--crm-error)' }} />}
              </button>
              {notifOpen && (
                <>
                  <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{ position: 'fixed', right: 16, top: 44, width: 360, maxHeight: 420, background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius-lg)', boxShadow: 'var(--crm-shadow-lg)', zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--crm-border-light)' }}>
                      <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>Notifications</span>
                      {unreadCount > 0 && <button onClick={markAllRead} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Mark all read</button>}
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {notifs.length === 0 ? (
                        <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No notifications</div>
                      ) : notifs.map(n => (
                        <Link key={n.id} href={n.entityType && n.entityId ? `/crm/${n.entityType === 'appointment' ? 'appointments' : n.entityType === 'client' ? `clients/${n.entityId}` : n.entityType === 'segment' ? 'segments' : ''}` : '/crm'}
                          onClick={() => setNotifOpen(false)}
                          style={{ display: 'block', padding: '10px 14px', borderBottom: '1px solid var(--crm-border-light)', textDecoration: 'none', background: n.readAt ? 'none' : 'var(--crm-bg)' }}>
                          <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: n.readAt ? 400 : 500, color: 'var(--crm-text-primary)' }}>{n.title}</div>
                          {n.body && <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>{n.body}</div>}
                          <div style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', marginTop: 4, fontFamily: 'monospace' }}>{new Date(n.createdAt).toLocaleString()}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto" style={{ padding: 'var(--crm-space-6)' }}>
            {children}
          </main>
        </div>

        {/* Search overlay */}
        {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

        {/* Command palette (Cmd+K) */}
        <CommandPalette />

        {/* Onboarding tour */}
        <CrmTour />

        {/* Toasts */}
        <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
          {toasts.map(t => (
            <div
              key={t.id}
              className="crm-card px-4 py-2 text-sm animate-in"
              style={{
                boxShadow: 'var(--crm-shadow-lg)',
                color: t.type === 'error' ? 'var(--crm-error)' : 'var(--crm-text-primary)',
              }}
            >
              {t.message}
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
