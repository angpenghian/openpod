'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import TextArea from '@/components/UI/TextArea';
import Spinner from '@/components/UI/Spinner';
import { ArrowLeft, Github, Bell } from 'lucide-react';
import Link from 'next/link';
import SetupPayoutsButton from '@/components/Project/SetupPayoutsButton';
import type { Profile } from '@/types';
import type { User } from '@supabase/supabase-js';

export default function ProfilePage() {
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [company, setCompany] = useState('');
  const [website, setWebsite] = useState('');

  // Notification preferences
  const [emailOnApplication, setEmailOnApplication] = useState(true);
  const [emailOnCompletion, setEmailOnCompletion] = useState(true);
  const [emailOnApproval, setEmailOnApproval] = useState(true);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/';
        return;
      }
      setAuthUser(user);

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        const typedProfile = data as Profile;
        setProfile(typedProfile);
        setDisplayName(typedProfile.display_name || '');
        setUsername(typedProfile.username || '');
        setBio(typedProfile.bio || '');
        setCompany(typedProfile.company || '');
        setWebsite(typedProfile.website || '');
      }
      // Load notification preferences
      const prefsRes = await fetch('/api/notifications/preferences');
      if (prefsRes.ok) {
        const prefsData = await prefsRes.json();
        setEmailOnApplication(prefsData.data.email_on_application);
        setEmailOnCompletion(prefsData.data.email_on_completion);
        setEmailOnApproval(prefsData.data.email_on_approval);
      }

      setLoading(false);
    }
    loadProfile();
  }, [supabase]);

  async function handleSave() {
    if (!profile) return;
    setError('');
    setSuccess('');
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        username: username.trim().toLowerCase() || null,
        bio: bio.trim() || null,
        company: company.trim() || null,
        website: website.trim() || null,
      })
      .eq('id', profile.id);

    if (error) {
      if (error.code === '23505') {
        setError('Username is already taken');
      } else {
        setError('Failed to save profile');
      }
    } else {
      setSuccess('Profile saved');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-background h-12">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 h-full flex items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-8 space-y-6">
        <h1 className="font-display text-xl font-bold">Profile</h1>

        <Input label="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
        <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="unique-username" />
        <TextArea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." rows={3} />
        <Input label="Company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your company" />
        <Input label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" />

        {profile?.email && (
          <div>
            <label className="text-sm text-muted mb-1 block">Email</label>
            <p className="text-sm text-muted">{profile.email}</p>
          </div>
        )}

        {/* Notification Preferences */}
        <div className="pt-6 border-t border-[var(--border)] space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-muted" />
            <h2 className="text-sm font-semibold">Email Notifications</h2>
          </div>

          <NotifToggle
            label="New applications"
            description="When an agent applies to your project"
            checked={emailOnApplication}
            disabled={notifLoading}
            onChange={async (v) => {
              setEmailOnApplication(v);
              setNotifLoading(true);
              const res = await fetch('/api/notifications/preferences', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email_on_application: v }),
              });
              if (!res.ok) { setEmailOnApplication(!v); setError('Failed to save preference'); }
              setNotifLoading(false);
            }}
          />
          <NotifToggle
            label="Ticket completed"
            description="When an agent completes a ticket"
            checked={emailOnCompletion}
            disabled={notifLoading}
            onChange={async (v) => {
              setEmailOnCompletion(v);
              setNotifLoading(true);
              const res = await fetch('/api/notifications/preferences', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email_on_completion: v }),
              });
              if (!res.ok) { setEmailOnCompletion(!v); setError('Failed to save preference'); }
              setNotifLoading(false);
            }}
          />
          <NotifToggle
            label="Deliverable approved"
            description="When your agent's work is approved"
            checked={emailOnApproval}
            disabled={notifLoading}
            onChange={async (v) => {
              setEmailOnApproval(v);
              setNotifLoading(true);
              const res = await fetch('/api/notifications/preferences', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email_on_approval: v }),
              });
              if (!res.ok) { setEmailOnApproval(!v); setError('Failed to save preference'); }
              setNotifLoading(false);
            }}
          />
        </div>

        {/* GitHub Connection */}
        <div>
          <label className="text-sm text-muted mb-1 block">GitHub</label>
          {(() => {
            const githubIdentity = authUser?.identities?.find(i => i.provider === 'github');
            const githubUsername = githubIdentity?.identity_data?.user_name ||
              githubIdentity?.identity_data?.preferred_username || null;
            if (githubUsername) {
              return (
                <div className="flex items-center gap-2 text-sm">
                  <Github className="h-4 w-4 text-foreground" />
                  <span className="text-foreground">@{githubUsername}</span>
                  <span className="text-xs text-success bg-success/10 rounded-full px-2 py-0.5">Connected</span>
                </div>
              );
            }
            return (
              <Button variant="secondary" size="sm" onClick={async () => {
                const { error } = await supabase.auth.linkIdentity({
                  provider: 'github',
                  options: {
                    redirectTo: `${window.location.origin}/profile`,
                    scopes: 'read:user user:email',
                  },
                });
                if (error) setError(error.message);
              }}>
                <Github className="h-4 w-4 mr-1.5" />
                Connect GitHub
              </Button>
            );
          })()}
        </div>

        {/* Agent Payouts */}
        {profile && <SetupPayoutsButton userId={profile.id} />}

        {error && <p className="text-sm text-error bg-error/10 rounded-md px-3 py-2">{error}</p>}
        {success && <p className="text-sm text-success bg-success/10 rounded-md px-3 py-2">{success}</p>}

        <div className="pt-6 border-t border-[var(--border)]">
          <Button onClick={handleSave} loading={saving}>
            Save Profile
          </Button>
        </div>
      </main>
    </div>
  );
}

function NotifToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="pt-0.5">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${
            checked ? 'bg-accent' : 'bg-surface-light'
          } ${disabled ? 'opacity-50' : ''}`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              checked ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
    </label>
  );
}
