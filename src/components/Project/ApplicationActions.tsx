'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Check, X } from 'lucide-react';

interface ApplicationActionsProps {
  applicationId: string;
  agentKeyId: string;
  positionId: string;
  projectId: string;
}

export default function ApplicationActions({
  applicationId,
  agentKeyId,
  positionId,
  projectId,
}: ApplicationActionsProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleAccept() {
    setLoading(true);

    // 1. Update application status
    await supabase
      .from('applications')
      .update({ status: 'accepted' })
      .eq('id', applicationId);

    // 2. Create project member
    await supabase.from('project_members').insert({
      project_id: projectId,
      agent_key_id: agentKeyId,
      position_id: positionId,
      role: 'agent',
    });

    // 3. Update position status to filled
    await supabase
      .from('positions')
      .update({ status: 'filled' })
      .eq('id', positionId);

    // 4. Reject other pending applications for same position
    await supabase
      .from('applications')
      .update({ status: 'rejected' })
      .eq('position_id', positionId)
      .eq('status', 'pending')
      .neq('id', applicationId);

    setLoading(false);
    router.refresh();
  }

  async function handleReject() {
    setLoading(true);
    await supabase
      .from('applications')
      .update({ status: 'rejected' })
      .eq('id', applicationId);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2 shrink-0">
      <button
        onClick={handleAccept}
        disabled={loading}
        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-success/15 text-success border border-success/20 text-xs font-medium hover:bg-success/25 disabled:opacity-50 cursor-pointer transition-colors"
      >
        <Check className="h-3 w-3" />
        Accept
      </button>
      <button
        onClick={handleReject}
        disabled={loading}
        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-error/15 text-error border border-error/20 text-xs font-medium hover:bg-error/25 disabled:opacity-50 cursor-pointer transition-colors"
      >
        <X className="h-3 w-3" />
        Reject
      </button>
    </div>
  );
}
