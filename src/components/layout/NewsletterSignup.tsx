'use client';

import { useState } from 'react';

/** Basic email regex for client-side validation */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    // Placeholder — actual Shopify customer marketing endpoint integration later
    console.log('Newsletter signup:', email);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="text-sm text-gray-700">
        <p className="font-medium">Thank you!</p>
        <p className="mt-1 text-gray-500">You&apos;ve been added to our list.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xs" noValidate>
      <p className="text-sm font-medium text-gray-900">
        Get 10% off your first order
      </p>
      <div className="mt-3 flex">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError('');
          }}
          className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-black focus:outline-none"
          aria-describedby={error ? 'newsletter-error' : undefined}
        />
        <button
          type="submit"
          className="shrink-0 border border-l-0 border-black bg-black px-4 py-2 text-sm text-white transition-colors hover:bg-gray-800"
        >
          Sign up
        </button>
      </div>
      {error && (
        <p id="newsletter-error" className="mt-1.5 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
