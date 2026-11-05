// apps/nextjs/src/app/login/page.tsx
'use client';
import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Crosshair,
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Coins,
  AlertCircle,
  Loader2,
} from 'lucide-react';
function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get('next') ?? '';
  const nextPath = /^\/(scans|new-scan|admin)(\/|\?|$)/.test(requested)
    ? requested
    : '/scans';
  const [mode, setMode] = useState<'login' | 'register'>(
    searchParams.get('mode') === 'register' ? 'register' : 'login',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          email: email.trim(),
          password,
          name: name.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Authentication failed');
      }
      router.push(nextPath);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message);
      setLoading(false);
    }
  }
  return (
    <div className="flex min-h-screen w-full flex-col justify-center bg-slate-950 px-4 py-12 text-slate-100 sm:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Stakeout Brand Emblem */}
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950">
            <Crosshair className="h-7 w-7 stroke-[2.5]" />
          </div>
        </div>
        <h1 className="mt-4 text-center text-2xl font-extrabold tracking-tight text-white uppercase">
          Stakeout Observatory
        </h1>
        <p className="mt-1 text-center text-xs text-slate-400">
          Device-Observed Mobile Search & AI GeoGrid Intelligence
        </p>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-8 shadow-2xl">
          {/* Mode Toggle Tabs */}
          <div className="mb-6 grid grid-cols-2 rounded-xl border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              className={`rounded-lg py-2 text-xs font-bold transition ${
                mode === 'login'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Agency Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
              }}
              className={`rounded-lg py-2 text-xs font-bold transition ${
                mode === 'register'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Agency Account
            </button>
          </div>
          {mode === 'register' && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/25">
              <Coins className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                Includes <strong>150 Free Starter Credits</strong> in your
                isolated agency ledger upon signup.
              </span>
            </div>
          )}
          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-950/40 p-3.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Agency or Operator Name
                </label>
                <div className="relative mt-1.5">
                  <UserIcon className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g., Marketing Divine LLC"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-3.5 py-2.5 text-xs"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Work Email Address
              </label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@agency.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-3.5 py-2.5 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Password
              </label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-3.5 py-2.5 text-xs"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating Session...
                </>
              ) : mode === 'login' ? (
                <>
                  Sign In to Stakeout
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Create Account & Claim 150 Credits
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
          <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4 text-[11px]">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Isolated Credit Ledger
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              HMAC-Signed Cookie
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400 text-xs">
          Loading Stakeout Login...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
