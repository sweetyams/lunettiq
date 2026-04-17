'use client';

import { useState, createContext, useContext, useCallback } from 'react';
import { CrmSidebar } from './CrmSidebar';
import { GlobalSearch } from './GlobalSearch';
import { CommandPalette } from './CommandPalette';

interface Toast { id: number; message: string; type: 'success' | 'error' }
interface ToastCtx { toast: (message: string, type?: 'success' | 'error') => void }
const ToastContext = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

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
              className="crm-btn-ghost flex items-center gap-2 text-xs"
              style={{ color: 'var(--crm-text-tertiary)', padding: '4px 10px', borderRadius: 'var(--crm-radius-md)', border: '1px solid var(--crm-border)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              Search…
              <kbd style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', background: 'var(--crm-bg)', padding: '1px 5px', borderRadius: 3, border: '1px solid var(--crm-border-light)' }}>⌘K</kbd>
            </button>
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
