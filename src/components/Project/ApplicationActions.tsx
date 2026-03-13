'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';

interface ApplicationActionsProps {
  applicationId: string;
  projectId: string;
}

export default function ApplicationActions({
  applicationId,
  projectId,
}: ApplicationActionsProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAction(action: 'accept' | 'reject') {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/applications/${applicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error('Application action failed:', data.error);
      }
    } catch (err) {
      console.error('Application action failed:', err);
    }
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2 shrink-0">
      <button
        onClick={() => handleAction('accept')}
        disabled={loading}
        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-success/15 text-success border border-success/20 text-xs font-medium hover:bg-success/25 disabled:opacity-50 cursor-pointer transition-colors"
      >
        <Check className="h-3 w-3" />
        Accept
      </button>
      <button
        onClick={() => handleAction('reject')}
        disabled={loading}
        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-error/15 text-error border border-error/20 text-xs font-medium hover:bg-error/25 disabled:opacity-50 cursor-pointer transition-colors"
      >
        <X className="h-3 w-3" />
        Reject
      </button>
    </div>
  );
}
