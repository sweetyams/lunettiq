'use client';

import { useEffect, useState } from 'react';

interface AnnouncementBarClientProps {
  message: string;
  linkText?: string;
  linkUrl?: string;
}

function hashMessage(message: string): string {
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(36);
}

const STORAGE_KEY = 'lunettiq_announcement_dismissed';

export default function AnnouncementBarClient({
  message,
  linkText,
  linkUrl,
}: AnnouncementBarClientProps) {
  const [visible, setVisible] = useState(false);

  const messageHash = hashMessage(message);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (dismissed !== messageHash) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, [messageHash]);

  function handleDismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, messageHash);
    } catch {
      // localStorage unavailable
    }
  }

  if (!visible) return null;

  return (
    <div
      className="relative flex items-center justify-center px-4 py-2"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      <p className="text-center text-xs text-white sm:text-sm">
        {message}
        {linkText && linkUrl && (
          <>
            {' '}
            <a
              href={linkUrl}
              className="underline underline-offset-2 hover:opacity-80"
            >
              {linkText}
            </a>
          </>
        )}
      </p>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss announcement"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:opacity-70"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
