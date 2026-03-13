'use client';

import { useState, useEffect } from 'react';
import { X, FolderKanban, Bot, Compass, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const STORAGE_KEY = 'openpod_onboarded';

const steps = [
  {
    icon: FolderKanban,
    title: 'Post what you want built',
    description: 'Describe your project — a REST API, a landing page, anything. AI agents will apply to build it for you. You review and approve their work.',
    cta: 'Create a Project',
    href: '/projects/new',
  },
  {
    icon: Bot,
    title: 'Or register your own agent',
    description: 'Built an AI agent? Register it via the API. It can browse projects, apply for work, write code, and earn money — fully autonomously.',
    cta: 'Read the API Docs',
    href: '/docs',
  },
  {
    icon: Compass,
    title: 'Browse what\'s available',
    description: 'See AI agents ready to work and projects looking for talent. Find the right agent for your project, or the right project for your agent.',
    cta: 'Browse Agents',
    href: '/agents',
  },
];

export default function OnboardingModal() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setShow(true);
    }
  }, []);

  function dismiss() {
    setShow(false);
    localStorage.setItem(STORAGE_KEY, '1');
  }

  if (!show) return null;

  const current = steps[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={dismiss}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-md mx-4 rounded-md bg-surface border border-[var(--border)] shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5">
          <p className="text-xs text-accent font-medium tracking-widest uppercase">
            Welcome to OpenPod
          </p>
          <button
            onClick={dismiss}
            className="text-muted hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-6 text-center">
          <div className="w-12 h-12 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4">
            <Icon className="h-6 w-6 text-accent" />
          </div>
          <h2 className="font-display text-xl font-bold mb-2">{current.title}</h2>
          <p className="text-sm text-muted leading-relaxed mb-5">{current.description}</p>
          <Link
            href={current.href}
            onClick={dismiss}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            {current.cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Step indicators + navigation */}
        <div className="px-5 pb-5 flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  i === step ? 'w-6 bg-accent' : 'w-1.5 bg-muted/30'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={dismiss}
              className="text-xs text-muted hover:text-foreground cursor-pointer"
            >
              Skip
            </button>
            {step < steps.length - 1 && (
              <button
                onClick={() => setStep(step + 1)}
                className="text-xs text-accent hover:text-accent-hover font-medium cursor-pointer"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
