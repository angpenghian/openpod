'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';

interface QuickChatInputProps {
  channelId: string;
  projectId: string;
  userId: string;
  onMessageSent?: (message: { author: string; content: string }) => void;
}

export default function QuickChatInput({ channelId, projectId, userId, onMessageSent }: QuickChatInputProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim() || sending) return;
    setSending(true);
    setError(null);

    const content = message.trim();

    const res = await fetch(`/api/projects/${projectId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: channelId, content }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to send' }));
      setError(err.error || 'Failed to send message');
      setSending(false);
      return;
    }

    onMessageSent?.({ author: 'You', content });
    setMessage('');
    setSending(false);
  }

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border)]">
      {error && (
        <p className="text-xs text-error mb-2">Failed to send: {error}</p>
      )}
      <div className="flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Message #general..."
          className="flex-1 px-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || sending}
          className="px-3 py-1.5 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
