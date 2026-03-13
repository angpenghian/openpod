'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/UI/Button';
import EmptyState from '@/components/UI/EmptyState';
import { MessageSquare, Plus, Send, Hash } from 'lucide-react';
import type { Channel, Message } from '@/types';

interface ChatAreaProps {
  channels: Channel[];
  initialMessages: Message[];
  defaultChannelId: string | null;
  projectId: string;
  userId: string;
}

export default function ChatArea({ channels, initialMessages, defaultChannelId, projectId, userId }: ChatAreaProps) {
  const [activeChannel, setActiveChannel] = useState(defaultChannelId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Supabase Realtime: subscribe to new messages on active channel
  useEffect(() => {
    if (!activeChannel) return;

    const channel = supabase
      .channel(`chat-${activeChannel}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${activeChannel}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          // Skip if we already have this message (from own send)
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Fetch with joins to get proper author names
          const { data } = await supabase
            .from('messages')
            .select('*, author_agent:agent_keys!author_agent_key_id(name), author_user:profiles!author_user_id(display_name)')
            .eq('id', newMsg.id)
            .single();
          if (data) {
            setMessages(prev => prev.map(m => m.id === newMsg.id ? (data as Message) : m));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannel, supabase]);

  async function switchChannel(channelId: string) {
    setActiveChannel(channelId);
    const { data } = await supabase
      .from('messages')
      .select('*, author_agent:agent_keys!author_agent_key_id(name), author_user:profiles!author_user_id(display_name)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(50);
    setMessages((data || []) as Message[]);
  }

  async function handleSend() {
    if (!newMessage.trim() || !activeChannel || sending) return;
    setSending(true);
    setSendError(null);

    const content = newMessage.trim();

    const res = await fetch(`/api/projects/${projectId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel_id: activeChannel, content }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to send' }));
      setSendError(err.error || 'Failed to send message');
      setSending(false);
      return;
    }

    const { data } = await res.json();
    if (data) setMessages(prev => [...prev, data as Message]);
    setNewMessage('');
    setSending(false);
  }

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!channelName.trim()) return;
    setCreatingChannel(true);

    const { data } = await supabase.from('channels').insert({
      project_id: projectId,
      name: channelName.trim().toLowerCase().replace(/\s+/g, '-'),
      is_default: false,
    }).select().single();

    if (data) {
      setShowNewChannel(false);
      setChannelName('');
      router.refresh();
      switchChannel(data.id);
    }
    setCreatingChannel(false);
  }

  const activeChannelName = channels.find(c => c.id === activeChannel)?.name || 'general';

  return (
    <div className="max-w-5xl">
      <h2 className="font-display text-lg font-bold mb-4">Team Chat</h2>

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[400px]">
        {/* Channel sidebar */}
        <div className="w-48 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display text-xs font-medium text-secondary tracking-widest uppercase">Channels</h3>
            <button
              onClick={() => setShowNewChannel(!showNewChannel)}
              className="text-muted hover:text-accent cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {showNewChannel && (
            <form onSubmit={handleCreateChannel} className="mb-2">
              <input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="channel-name"
                autoFocus
                className="w-full px-2 py-1 rounded-md bg-surface border border-accent/30 text-foreground text-sm placeholder:text-muted/40 focus:outline-none mb-1"
              />
              <div className="flex gap-1">
                <Button size="sm" type="submit" loading={creatingChannel} disabled={!channelName.trim()}>
                  Create
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowNewChannel(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          <div className="space-y-0.5">
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => switchChannel(ch.id)}
                className={`w-full text-left px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeChannel === ch.id
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted hover:text-foreground hover:bg-surface'
                }`}
              >
                <Hash className="h-3 w-3 shrink-0" />
                {ch.name}
              </button>
            ))}
            {channels.length === 0 && (
              <p className="text-xs text-muted px-3 py-2">No channels yet</p>
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 flex flex-col rounded-md bg-surface border border-[var(--border)]">
          <div className="px-4 py-2.5 border-b border-[var(--border)]">
            <h3 className="text-sm font-medium flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-muted" />
              {activeChannelName}
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length > 0 ? (
              messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} isOwn={msg.author_user_id === userId} />
              ))
            ) : (
              <div className="flex items-center justify-center h-full">
                <EmptyState
                  icon={<MessageSquare className="h-10 w-10" />}
                  title="No messages yet"
                  description={`Start a conversation in #${activeChannelName}`}
                />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {activeChannel && (
            <div className="px-4 py-3 border-t border-[var(--border)]">
              {sendError && (
                <p className="text-xs text-error mb-2">Failed to send: {sendError}</p>
              )}
              <div className="flex gap-2">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={`Message #${activeChannelName}...`}
                  className="flex-1 px-3 py-2 rounded-md bg-background border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="px-3 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function stripSim(name: string) {
  return name.replace(/^SIM-/, '');
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const isAgent = !!message.author_agent_key_id;
  const rawName = message.author_user?.display_name || message.author_agent?.name || (isOwn ? 'You' : 'Unknown');
  const authorName = isAgent ? stripSim(rawName) : rawName;

  return (
    <div className="flex gap-3">
      <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 text-xs font-medium ${
        isAgent ? 'bg-secondary/15 text-secondary' : 'bg-accent/15 text-accent'
      }`}>
        {authorName.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{authorName}</span>
          {isAgent && <span className="text-xs text-secondary">bot</span>}
          <span className="text-xs text-muted">
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-sm text-muted mt-0.5">{message.content}</p>
      </div>
    </div>
  );
}
