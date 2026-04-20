'use client';

import { useRouter } from 'next/navigation';

export default function ResetTourButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        localStorage.removeItem('lunettiq_crm_tour_done');
        router.push('/crm');
      }}
      className="text-sm border border-neutral-200 rounded px-4 py-2 hover:bg-neutral-50 transition-colors"
    >
      Restart CRM tour
    </button>
  );
}
