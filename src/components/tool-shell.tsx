'use client';

import Link from 'next/link';
import { ReactNode } from 'react';
import { Files, Gauge, HardDrive, Moon, Scissors, Sun, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_BASE_URL } from '@/lib/config';

type ToolShellProps = {
  pathname: string;
  darkMode?: boolean;
  onToggleDarkMode: () => void;
  totalProcessed: number;
  isWarmingUp: boolean;
  isServiceReady: boolean;
  badgeLabel: string;
  title: string;
  subtitle: string;
  children: ReactNode;
};

const navItems = [
  { href: '/', label: 'Compress', icon: Gauge },
  { href: '/merge', label: 'Merge', icon: Files },
  { href: '/split', label: 'Split', icon: Scissors },
];

export function ToolShell({
  pathname,
  darkMode,
  onToggleDarkMode,
  totalProcessed,
  isWarmingUp,
  isServiceReady,
  badgeLabel,
  title,
  subtitle,
  children,
}: ToolShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.12),_transparent_32%),linear-gradient(to_bottom_right,_rgb(248_250_252),_white,_rgb(241_245_249))] dark:bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.18),_transparent_28%),linear-gradient(to_bottom_right,_rgb(2_6_23),_rgb(15_23_42),_rgb(30_41_59))]">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-white">DocSqueeze</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">PDF toolkit for quick testing</p>
            </div>
          </div>

          <nav className="scrollbar-hide flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {totalProcessed > 0 && (
              <div className="hidden items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs text-orange-700 sm:flex dark:bg-orange-900/20 dark:text-orange-300">
                <HardDrive className="h-3.5 w-3.5" />
                {totalProcessed.toLocaleString()} processed
              </div>
            )}
            <div
              className={`hidden rounded-full px-3 py-1.5 text-xs font-medium sm:flex ${
                isWarmingUp
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  : isServiceReady
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
              }`}
            >
              {isWarmingUp ? 'Checking API...' : isServiceReady ? 'API reachable' : 'API unavailable'}
            </div>
            <Button variant="ghost" size="icon" onClick={onToggleDarkMode} aria-label="Toggle color theme">
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-6 pt-10 md:pb-8 md:pt-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
              <Zap className="h-4 w-4" />
              {badgeLabel}
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl dark:text-white">{title}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 md:text-lg dark:text-slate-300">{subtitle}</p>
          </div>
        </section>

        {children}
      </main>

      <footer className="mt-20 border-t border-slate-200/80 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between dark:text-slate-400">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">DocSqueeze</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Frontend sends files to the configured API for processing.</p>
            </div>
          </div>
          <div className="space-y-1 text-left md:text-right">
            <p>Privacy, terms, and account flows are not built in this test frontend yet.</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              API base URL: <code>{API_BASE_URL}</code>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function SurfaceCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-slate-200 bg-white/90 shadow-xl shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none ${className}`}>
      {children}
    </div>
  );
}

export function InfoStrip({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
      {children}
    </div>
  );
}
