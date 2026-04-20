'use client';

import { useState, useEffect } from 'react';
import { track } from '@/lib/tracking';

export default function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('lunettiq_tracking_consent');
    if (!consent) setShow(true);
  }, []);

  function accept() {
    localStorage.setItem('lunettiq_tracking_consent', 'granted');
    track({ event: 'consent_granted', data: {} });
    setShow(false);
    window.location.reload(); // reload to init consent-gated pixels
  }

  function decline() {
    localStorage.setItem('lunettiq_tracking_consent', 'denied');
    track({ event: 'consent_denied', data: {} });
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <p className="text-sm text-gray-600">
          We use cookies to improve your experience and measure site performance.{' '}
          <a href="/pages/privacy" className="underline hover:text-black">Privacy policy</a>
        </p>
        <div className="flex gap-2 shrink-0">
          <button onClick={decline} className="px-4 py-2 text-sm text-gray-500 hover:text-black">
            Decline
          </button>
          <button onClick={accept} className="px-4 py-2 text-sm bg-black text-white rounded-full hover:bg-gray-800">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
