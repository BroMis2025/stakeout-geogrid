// apps/nextjs/src/app/page.tsx
import Link from 'next/link';
import { LeadGenWidget } from '@/components/LeadGenWidget';
import { Crosshair, ShieldCheck, Zap, Sparkles } from 'lucide-react';
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Navbar */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-slate-950">
            <Crosshair className="h-5 w-5 stroke-[2.5]" />
          </div>
          <span className="text-lg font-black tracking-wider text-white uppercase">
            Stakeout
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-300 hover:text-white"
          >
            Sign In
          </Link>
          <Link
            href="/login?mode=register"
            className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
          >
            Get Started
          </Link>
        </div>
      </header>
      {/* Hero Section with Lead Gen Widget */}
      <section className="mx-auto max-w-5xl px-6 pt-12 pb-20">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">
            Device-Observed Mobile Search &{' '}
            <span className="text-emerald-400">AI GeoGrid Intelligence</span>
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-slate-400 sm:text-base">
            Measure local rankings on Android cloud phones. Open a pin to review
            the search results and recording.
          </p>
        </div>
        {/* Lead Gen Widget */}
        <LeadGenWidget />
      </section>
    </div>
  );
}
