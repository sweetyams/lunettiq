'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Location { id: string; name: string; address: { address1?: string; city?: string } | null }
interface Slot { start: string; end: string }
interface Appointment { id: string; title: string; status: string; startsAt: string; endsAt: string; locationName: string; notes: string | null }

interface AppointmentType { id: string; name: string; durationMinutes: number; bufferMinutes: number }

export default function AppointmentsClient({ locations }: { locations: Location[] }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [booking, setBooking] = useState(false);
  const [step, setStep] = useState(0); // 0=service, 1=location, 2=date, 3=time, 4=confirm
  const [service, setService] = useState('');
  const [serviceDuration, setServiceDuration] = useState(30);
  const [serviceBuffer, setServiceBuffer] = useState(0);
  const [locationId, setLocationId] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    fetch('/api/account/appointments', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAppointments(d.data ?? []); });
    fetch('/api/account/appointment-types')
      .then(r => r.json())
      .then(d => setAppointmentTypes(d.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!date || !locationId) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    fetch(`/api/account/appointments?slots=1&date=${date}&locationId=${locationId}&duration=${serviceDuration}&buffer=${serviceBuffer}`)
      .then(r => r.json())
      .then(d => setSlots(d.data ?? []))
      .finally(() => setLoadingSlots(false));
  }, [date, locationId]);

  async function handleBook() {
    if (!selectedSlot) return;
    setSubmitting(true);
    const res = await fetch('/api/account/appointments', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, startsAt: selectedSlot.start, title: service, notes: notes || undefined, duration: serviceDuration }),
    });
    if (res.ok) {
      const d = await res.json();
      setAppointments([d.data, ...appointments]);
      setBooking(false);
      setStep(0); setService(''); setLocationId(''); setDate(''); setSelectedSlot(null); setNotes('');
    }
    setSubmitting(false);
  }

  async function handleCancel(id: string) {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    const res = await fetch(`/api/account/appointments?id=${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a));
    } else {
      const e = await res.json().catch(() => ({}));
      alert(e.error || 'Could not cancel appointment');
    }
  }

  function reset() {
    setBooking(false); setStep(0); setService(''); setServiceDuration(30); setServiceBuffer(0); setLocationId(''); setDate(''); setSelectedSlot(null); setNotes('');
  }

  const loc = locations.find(l => l.id === locationId);
  const upcoming = appointments.filter(a => new Date(a.startsAt) >= new Date() && a.status !== 'cancelled');
  const past = appointments.filter(a => new Date(a.startsAt) < new Date() || a.status === 'cancelled');

  // Generate next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i + 1); d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium">Appointments</h2>
        {!booking && <button onClick={() => setBooking(true)} className="text-sm border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors">Book Appointment</button>}
      </div>

      {/* Booking flow */}
      {booking && (
        <div className="border border-gray-200 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">Step {step + 1} of 5</span>
            <button onClick={reset} className="text-sm text-gray-400 hover:text-black">Cancel</button>
          </div>

          {/* Step 0: Service */}
          {step === 0 && (
            <div>
              <p className="text-sm font-medium mb-3">What do you need?</p>
              <div className="grid grid-cols-2 gap-3">
                {appointmentTypes.map(s => (
                  <button key={s.id} onClick={() => { setService(s.name); setServiceDuration(s.durationMinutes); setServiceBuffer(s.bufferMinutes); setStep(1); }}
                    className="border border-gray-200 rounded-lg p-4 text-left hover:border-black transition-colors">
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{s.durationMinutes} min</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Location */}
          {step === 1 && (
            <div>
              <p className="text-sm font-medium mb-3">Where?</p>
              <div className="space-y-3">
                {locations.map(l => (
                  <button key={l.id} onClick={() => { setLocationId(l.id); setStep(2); }}
                    className="w-full border border-gray-200 rounded-lg p-4 text-left hover:border-black transition-colors">
                    <div className="text-sm font-medium">{l.name}</div>
                    {l.address && <div className="text-xs text-gray-500 mt-1">{l.address.address1}, {l.address.city}</div>}
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(0)} className="text-sm text-gray-400 mt-3 hover:text-black">← Back</button>
            </div>
          )}

          {/* Step 2: Date */}
          {step === 2 && (
            <div>
              <p className="text-sm font-medium mb-3">Pick a date</p>
              <div className="grid grid-cols-7 gap-2">
                {dates.map(d => {
                  const dt = new Date(d + 'T12:00:00');
                  const dayOfWeek = dt.getDay();
                  if (dayOfWeek === 0) return null; // skip Sunday
                  return (
                    <button key={d} onClick={() => { setDate(d); setStep(3); }}
                      className={`border rounded-lg p-3 text-center hover:border-black transition-colors ${date === d ? 'border-black bg-black text-white' : 'border-gray-200'}`}>
                      <div className="text-xs text-gray-500">{dt.toLocaleDateString('en-CA', { weekday: 'short' })}</div>
                      <div className="text-sm font-medium">{dt.getDate()}</div>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setStep(1)} className="text-sm text-gray-400 mt-3 hover:text-black">← Back</button>
            </div>
          )}

          {/* Step 3: Time */}
          {step === 3 && (
            <div>
              <p className="text-sm font-medium mb-3">Pick a time — {fmtDate(date + 'T12:00:00')}</p>
              {loadingSlots ? (
                <p className="text-sm text-gray-400">Loading available times…</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-gray-400">No available times on this date. <button onClick={() => setStep(2)} className="underline">Try another date</button></p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map(s => (
                    <button key={s.start} onClick={() => { setSelectedSlot(s); setStep(4); }}
                      className={`border rounded-lg p-2 text-sm text-center hover:border-black transition-colors ${selectedSlot?.start === s.start ? 'border-black bg-black text-white' : 'border-gray-200'}`}>
                      {fmtTime(s.start)}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setStep(2)} className="text-sm text-gray-400 mt-3 hover:text-black">← Back</button>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && selectedSlot && (
            <div>
              <p className="text-sm font-medium mb-4">Confirm your appointment</p>
              <div className="border border-gray-200 rounded-lg p-4 space-y-2 mb-4">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Service</span><span>{service}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Location</span><span>{loc?.name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Date</span><span>{fmtDate(selectedSlot.start)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Time</span><span>{fmtTime(selectedSlot.start)}</span></div>
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes for us? (optional)" rows={2}
                className="w-full border border-gray-200 rounded-lg p-3 text-sm mb-4 outline-none focus:border-black" />
              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="text-sm text-gray-400 hover:text-black">← Back</button>
                <button onClick={handleBook} disabled={submitting}
                  className="flex-1 bg-black text-white text-sm py-3 hover:bg-gray-800 transition-colors disabled:opacity-50">
                  {submitting ? 'Booking…' : 'Confirm Booking'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Upcoming</h3>
          <div className="space-y-3">
            {upcoming.map(a => (
              <div key={a.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-medium">{a.title}</div>
                    <div className="text-sm text-gray-500 mt-1">{fmtDate(a.startsAt)} · {fmtTime(a.startsAt)}</div>
                    <div className="text-xs text-gray-400 mt-1">{a.locationName}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs border border-gray-200 px-2 py-0.5 uppercase">{a.status}</span>
                    {(a.status === 'scheduled' || a.status === 'confirmed') && (new Date(a.startsAt).getTime() - Date.now()) > 24 * 3600000 && (
                      <button onClick={() => handleCancel(a.id)} className="text-xs text-gray-400 hover:text-red-600 transition-colors">Cancel</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Past</h3>
          <div className="space-y-3">
            {past.map(a => (
              <div key={a.id} className="border border-gray-200 rounded-lg p-4 opacity-60">
                <div className="text-sm font-medium">{a.title}</div>
                <div className="text-sm text-gray-500 mt-1">{fmtDate(a.startsAt)} · {fmtTime(a.startsAt)} · {a.locationName}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!upcoming.length && !past.length && !booking && (
        <p className="text-sm text-gray-400">No appointments yet. Book your first one above.</p>
      )}
    </div>
  );
}
