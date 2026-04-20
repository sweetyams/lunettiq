'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/crm/CrmShell';
import { StaffScheduleEditor } from '@/components/crm/StaffScheduleEditor';
import { useRouter } from 'next/navigation';

interface StaffMember {
  id: string; firstName: string | null; lastName: string | null; email: string | null;
  imageUrl: string | null; role: string; locationIds: string[]; banned: boolean; offboarded: boolean;
}
interface Invitation {
  id: string; emailAddress: string; role: string; locationIds: string[]; createdAt: string;
}

const ROLES = ['owner', 'manager', 'optician', 'sa', 'read_only'] as const;
const ROLE_LABELS: Record<string, string> = { owner: 'Owner', manager: 'Manager', optician: 'Optician', sa: 'Sales Associate', read_only: 'Read Only' };
const ROLE_COLORS: Record<string, string> = { owner: 'var(--crm-accent)', manager: '#2563eb', optician: '#16a34a', sa: 'var(--crm-text-secondary)', read_only: 'var(--crm-text-tertiary)' };
const LOCATIONS: Record<string, string> = { loc_plateau: 'Plateau', loc_dix30: 'Dix30' };

interface Props { staff: StaffMember[]; invitations: Invitation[] }

export function StaffManagementClient({ staff: initialStaff, invitations: initialInvitations }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [locFilter, setLocFilter] = useState<string>('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = initialStaff.filter(s => {
    if (roleFilter && s.role !== roleFilter) return false;
    if (locFilter && !s.locationIds.includes(locFilter)) return false;
    return true;
  });

  async function apiCall(url: string, opts: RequestInit) {
    const res = await fetch(url, { credentials: 'include', ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { toast(data.error || 'Failed', 'error'); return null; }
    return data;
  }

  function refresh() { router.refresh(); }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-3)' }}>
        <Link href="/crm/settings" className="crm-btn crm-btn-ghost" style={{ padding: 0 }}>← Settings</Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--crm-space-5)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, margin: 0 }}>Staff</h1>
        <button onClick={() => setInviteOpen(true)} className="crm-btn crm-btn-primary">+ Invite</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-4)' }}>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="crm-input">
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select value={locFilter} onChange={e => setLocFilter(e.target.value)} className="crm-input">
          <option value="">All locations</option>
          {Object.entries(LOCATIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Pending invitations */}
      {initialInvitations.length > 0 && (
        <div className="crm-card" style={{ padding: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-4)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--crm-space-3)' }}>Pending Invitations</div>
          {initialInvitations.map(inv => (
            <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--crm-space-2) 0', borderBottom: '1px solid var(--crm-border-light)' }}>
              <div style={{ fontSize: 'var(--crm-text-sm)' }}>
                <span style={{ fontWeight: 500 }}>{inv.emailAddress}</span>
                <span className="crm-badge" style={{ marginLeft: 'var(--crm-space-2)', background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)' }}>{ROLE_LABELS[inv.role] || inv.role}</span>
              </div>
              <button onClick={async () => {
                await apiCall(`/api/crm/staff/invitations/${inv.id}`, { method: 'DELETE' });
                toast('Invitation revoked'); refresh();
              }} className="crm-btn crm-btn-ghost" style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-error)' }}>Revoke</button>
            </div>
          ))}
        </div>
      )}

      {/* Staff table */}
      <div className="crm-card" style={{ overflow: 'visible' }}>
        <table className="crm-table">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Role</th><th>Locations</th><th>Status</th><th style={{ width: 80 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2)' }}>
                    {s.imageUrl && <img src={s.imageUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />}
                    <span style={{ fontWeight: 500 }}>{s.firstName} {s.lastName}</span>
                  </div>
                </td>
                <td style={{ color: 'var(--crm-text-secondary)' }}>{s.email}</td>
                <td>
                  {editingId === s.id ? (
                    <RoleEditor current={s.role} staffName={`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()} onSave={async (role) => {
                      await apiCall(`/api/crm/staff/${s.id}`, { method: 'PATCH', body: JSON.stringify({ role }) });
                      toast('Role updated'); setEditingId(null); refresh();
                    }} onCancel={() => setEditingId(null)} />
                  ) : (
                    <span className="crm-badge" style={{ background: 'var(--crm-surface-hover)', color: ROLE_COLORS[s.role] || 'var(--crm-text-secondary)' }}>{ROLE_LABELS[s.role] || s.role}</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 'var(--crm-space-1)', flexWrap: 'wrap' }}>
                    {s.locationIds.map(id => <span key={id} className="crm-badge" style={{ background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)' }}>{LOCATIONS[id] || id}</span>)}
                    {!s.locationIds.length && <span style={{ color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-xs)' }}>—</span>}
                  </div>
                </td>
                <td>
                  {s.offboarded ? <span style={{ color: 'var(--crm-error)', fontSize: 'var(--crm-text-xs)' }}>Offboarded</span>
                    : s.banned ? <span style={{ color: 'var(--crm-warning)', fontSize: 'var(--crm-text-xs)' }}>Suspended</span>
                    : <span style={{ color: 'var(--crm-success)', fontSize: 'var(--crm-text-xs)' }}>Active</span>}
                </td>
                <td>
                  <ActionsMenu staff={s} onEditRole={() => setEditingId(s.id)} apiCall={apiCall} toast={toast} refresh={refresh} />
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--crm-space-8)', color: 'var(--crm-text-tertiary)' }}>No staff found</td></tr>}
          </tbody>
        </table>
      </div>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} apiCall={apiCall} toast={toast} refresh={refresh} />}
    </div>
  );
}

/* ── Role Editor ────────────────────────────────────── */

function RoleEditor({ current, staffName, onSave, onCancel }: { current: string; staffName: string; onSave: (role: string) => void; onCancel: () => void }) {
  const [role, setRole] = useState(current);
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div style={{ display: 'flex', gap: 'var(--crm-space-2)', alignItems: 'center', fontSize: 'var(--crm-text-xs)' }}>
        <span>Change {staffName} from {ROLE_LABELS[current]} to {ROLE_LABELS[role]}?</span>
        <button onClick={() => onSave(role)} className="crm-btn crm-btn-primary" style={{ padding: '2px 8px', fontSize: 'var(--crm-text-xs)' }}>Confirm</button>
        <button onClick={() => setConfirming(false)} className="crm-btn crm-btn-ghost" style={{ padding: '2px 8px', fontSize: 'var(--crm-text-xs)' }}>×</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--crm-space-2)', alignItems: 'center' }}>
      <select value={role} onChange={e => setRole(e.target.value)} className="crm-input" style={{ fontSize: 'var(--crm-text-xs)' }}>
        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
      </select>
      <button onClick={() => role !== current ? setConfirming(true) : onCancel()} className="crm-btn crm-btn-primary" style={{ padding: '2px 8px', fontSize: 'var(--crm-text-xs)' }}>Save</button>
      <button onClick={onCancel} className="crm-btn crm-btn-ghost" style={{ padding: '2px 8px', fontSize: 'var(--crm-text-xs)' }}>×</button>
    </div>
  );
}

/* ── Actions Menu ───────────────────────────────────── */

function ActionsMenu({ staff: s, onEditRole, apiCall, toast, refresh }: {
  staff: StaffMember; onEditRole: () => void;
  apiCall: (url: string, opts: RequestInit) => Promise<unknown>;
  toast: (msg: string, type?: 'success' | 'error') => void; refresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmOffboard, setConfirmOffboard] = useState(false);
  const [editLocs, setEditLocs] = useState(false);
  const [editSchedule, setEditSchedule] = useState(false);

  if (s.offboarded) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} className="crm-btn crm-btn-ghost" style={{ padding: '4px 8px' }}>···</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div className="crm-card" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 41, padding: 'var(--crm-space-1)', minWidth: 160, boxShadow: 'var(--crm-shadow-lg)' }}>
            <MenuBtn onClick={() => { setOpen(false); onEditRole(); }}>Edit role</MenuBtn>
            <MenuBtn onClick={() => { setOpen(false); setEditLocs(true); }}>Edit locations</MenuBtn>
            <MenuBtn onClick={() => { setOpen(false); setEditSchedule(true); }}>Schedule</MenuBtn>
            {!s.banned && <MenuBtn onClick={async () => {
              await apiCall(`/api/crm/staff/${s.id}/suspend`, { method: 'POST', body: JSON.stringify({ action: 'suspend' }) });
              toast('Staff suspended'); setOpen(false); refresh();
            }}>Suspend</MenuBtn>}
            {s.banned && !s.offboarded && <MenuBtn onClick={async () => {
              await apiCall(`/api/crm/staff/${s.id}/suspend`, { method: 'POST', body: JSON.stringify({ action: 'reinstate' }) });
              toast('Staff reinstated'); setOpen(false); refresh();
            }}>Reinstate</MenuBtn>}
            <MenuBtn danger onClick={() => { setOpen(false); setConfirmOffboard(true); }}>Offboard</MenuBtn>
          </div>
        </>
      )}
      {editLocs && <LocationEditor current={s.locationIds} onSave={async (locationIds, primaryLocationId) => {
        await apiCall(`/api/crm/staff/${s.id}`, { method: 'PATCH', body: JSON.stringify({ locationIds, primaryLocationId }) });
        toast('Locations updated'); setEditLocs(false); refresh();
      }} onCancel={() => setEditLocs(false)} />}
      {confirmOffboard && <OffboardModal staffId={s.id} name={`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()} apiCall={apiCall} toast={toast} refresh={refresh} onClose={() => setConfirmOffboard(false)} />}
      {editSchedule && <StaffScheduleEditor staffId={s.id} staffName={`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()} onClose={() => setEditSchedule(false)} />}
    </div>
  );
}

function MenuBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
      fontSize: 'var(--crm-text-sm)', background: 'none', border: 'none', cursor: 'pointer',
      color: danger ? 'var(--crm-error)' : 'var(--crm-text-primary)', fontFamily: 'var(--crm-font)',
      borderRadius: 'var(--crm-radius-sm)',
    }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--crm-surface-hover)')}
       onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
      {children}
    </button>
  );
}

/* ── Offboard Modal (two-step) ───────────────────────── */

function OffboardModal({ staffId, name, apiCall, toast, refresh, onClose }: {
  staffId: string; name: string;
  apiCall: (url: string, opts: RequestInit) => Promise<any>;
  toast: (msg: string, type?: 'success' | 'error') => void; refresh: () => void; onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [impact, setImpact] = useState<{ appointmentCount: number; intakeCount: number } | null>(null);
  const [typed, setTyped] = useState('');
  const [loading, setLoading] = useState(true);

  // Step 1: fetch impact
  useState(() => {
    fetch(`/api/crm/staff/${staffId}/offboard`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setImpact(d.data ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  });

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '25%', left: '50%', transform: 'translateX(-50%)', width: 420, background: 'var(--crm-surface)', borderRadius: 'var(--crm-radius-xl)', boxShadow: 'var(--crm-shadow-overlay)', padding: 'var(--crm-space-6)', zIndex: 51 }}>
        <h3 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>Offboard {name}</h3>

        {step === 1 && (
          <>
            <p style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)', marginBottom: 'var(--crm-space-4)' }}>
              This will permanently disable their account and reassign their open work:
            </p>
            {loading ? <p style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>Loading impact…</p> : impact && (
              <div style={{ background: 'var(--crm-bg)', borderRadius: 'var(--crm-radius-md)', padding: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-4)', fontSize: 'var(--crm-text-sm)' }}>
                <div>{impact.appointmentCount} open appointment{impact.appointmentCount !== 1 ? 's' : ''} will be unassigned</div>
                <div>{impact.intakeCount} open intake{impact.intakeCount !== 1 ? 's' : ''} will be unassigned</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--crm-space-2)', justifyContent: 'flex-end' }}>
              <button onClick={onClose} className="crm-btn crm-btn-secondary">Cancel</button>
              <button onClick={() => setStep(2)} className="crm-btn" style={{ background: 'var(--crm-error)', color: '#fff', border: 'none' }}>Continue</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ fontSize: 'var(--crm-text-sm)', marginBottom: 'var(--crm-space-2)' }}>Type <strong>{name}</strong> to confirm:</p>
            <input value={typed} onChange={e => setTyped(e.target.value)} className="crm-input" style={{ width: '100%', marginBottom: 'var(--crm-space-4)' }} />
            <div style={{ display: 'flex', gap: 'var(--crm-space-2)', justifyContent: 'flex-end' }}>
              <button onClick={() => setStep(1)} className="crm-btn crm-btn-secondary">Back</button>
              <button onClick={async () => {
                await apiCall(`/api/crm/staff/${staffId}/offboard`, { method: 'POST', body: JSON.stringify({ confirmName: typed }) });
                toast('Staff offboarded'); onClose(); refresh();
              }} disabled={typed.trim().toLowerCase() !== name.toLowerCase()} className="crm-btn" style={{
                background: typed.trim().toLowerCase() === name.toLowerCase() ? 'var(--crm-error)' : 'var(--crm-surface-hover)',
                color: typed.trim().toLowerCase() === name.toLowerCase() ? '#fff' : 'var(--crm-text-tertiary)', border: 'none',
              }}>Offboard</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ── Location Editor ────────────────────────────────── */

function LocationEditor({ current, onSave, onCancel }: { current: string[]; onSave: (locs: string[], primary: string) => void; onCancel: () => void }) {
  const [locs, setLocs] = useState<string[]>(current);
  const [primary, setPrimary] = useState(current[0] ?? '');

  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '25%', left: '50%', transform: 'translateX(-50%)', width: 360, background: 'var(--crm-surface)', borderRadius: 'var(--crm-radius-xl)', boxShadow: 'var(--crm-shadow-overlay)', padding: 'var(--crm-space-6)', zIndex: 51 }}>
        <h3 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, marginBottom: 'var(--crm-space-4)' }}>Edit Locations</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2)', marginBottom: 'var(--crm-space-4)' }}>
          {Object.entries(LOCATIONS).map(([k, v]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2)', fontSize: 'var(--crm-text-sm)', cursor: 'pointer' }}>
              <input type="checkbox" checked={locs.includes(k)} onChange={e => {
                const next = e.target.checked ? [...locs, k] : locs.filter(l => l !== k);
                setLocs(next);
                if (!next.includes(primary)) setPrimary(next[0] ?? '');
              }} />
              {v}
            </label>
          ))}
        </div>
        {locs.length > 1 && (
          <div style={{ marginBottom: 'var(--crm-space-4)' }}>
            <Label>Primary location</Label>
            <select value={primary} onChange={e => setPrimary(e.target.value)} className="crm-input" style={{ width: '100%' }}>
              {locs.map(k => <option key={k} value={k}>{LOCATIONS[k] || k}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className="crm-btn crm-btn-secondary">Cancel</button>
          <button onClick={() => onSave(locs, primary || locs[0])} disabled={locs.length === 0} className="crm-btn crm-btn-primary">Save</button>
        </div>
      </div>
    </>
  );
}

/* ── Invite Modal ───────────────────────────────────── */

function InviteModal({ onClose, apiCall, toast, refresh }: {
  onClose: () => void;
  apiCall: (url: string, opts: RequestInit) => Promise<unknown>;
  toast: (msg: string, type?: 'success' | 'error') => void; refresh: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('sa');
  const [locs, setLocs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!email) return;
    setSaving(true);
    const result = await apiCall('/api/crm/staff/invite', { method: 'POST', body: JSON.stringify({ email, role, locationIds: locs, primaryLocationId: locs[0] }) });
    if (result) { toast('Invitation sent'); onClose(); refresh(); }
    setSaving(false);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 420, background: 'var(--crm-surface)', borderRadius: 'var(--crm-radius-xl)', boxShadow: 'var(--crm-shadow-overlay)', padding: 'var(--crm-space-6)', zIndex: 51 }}>
        <h3 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, marginBottom: 'var(--crm-space-5)' }}>Invite Staff</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
          <div>
            <Label>Email</Label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="crm-input" style={{ width: '100%' }} placeholder="name@lunettiq.com" />
          </div>
          <div>
            <Label>Role</Label>
            <select value={role} onChange={e => setRole(e.target.value)} className="crm-input" style={{ width: '100%' }}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div>
            <Label>Locations</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2)' }}>
              {Object.entries(LOCATIONS).map(([k, v]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2)', fontSize: 'var(--crm-text-sm)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={locs.includes(k)} onChange={e => setLocs(e.target.checked ? [...locs, k] : locs.filter(l => l !== k))} />
                  {v}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--crm-space-2)', justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="crm-btn crm-btn-secondary">Cancel</button>
            <button onClick={handleSubmit} disabled={saving || !email || locs.length === 0} className="crm-btn crm-btn-primary">
              {saving ? 'Sending…' : 'Send Invitation'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{children}</div>;
}
