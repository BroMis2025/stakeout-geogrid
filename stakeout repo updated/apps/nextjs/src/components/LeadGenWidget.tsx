// apps/nextjs/src/components/LeadGenWidget.tsx
'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Crosshair,
  Search,
  Sparkles,
  MapPin,
  ArrowRight,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Coins,
} from 'lucide-react';
export function LeadGenWidget() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [locationQuery, setLocationQuery] = useState('Lakeland, FL');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  async function handleRunFreeTest(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim() || !keyword.trim() || !locationQuery.trim()) {
      setErrorMsg(
        'Please fill in your business name, keyword, and target city.',
      );
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Geocode location query via OpenStreetMap Nominatim
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(
          locationQuery,
        )}`,
      );
      const geoResults = await geoRes.json();
      if (!Array.isArray(geoResults) || geoResults.length === 0) {
        throw new Error(
          'Could not resolve city/location coordinates. Try entering "City, State" (e.g. Orlando, FL).',
        );
      }
      const lat = Number(geoResults[0].lat);
      const lng = Number(geoResults[0].lon);
      // 2. Dispatch free 3x3 teaser scan
      const res = await fetch('/api/leads/teaser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetBusiness: businessName.trim(),
          keyword: keyword.trim(),
          lat,
          lng,
          email,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? 'Failed to run free test scan');
      // Redirect straight into the live MapLibre viewer
      router.push(data.reportPath);
    } catch (err: any) {
      setErrorMsg(err.message);
      setLoading(false);
    }
  }
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-emerald-500/30 bg-slate-900/90 p-8 shadow-2xl">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold">
          <Sparkles className="h-3.5 w-3.5" />
          Free local rank preview (3×3 Grid)
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
          Test Your Local Map Ranking in 60 Seconds
        </h2>
        <p className="text-xs text-slate-400 sm:text-sm">
          Enter your Google Business Profile name and target keyword to see
          where you rank across the map.
        </p>
      </div>
      {errorMsg && (
        <div className="mt-6 rounded-xl border border-red-500/40 bg-red-950/40 p-3.5 text-xs text-red-200">
          {errorMsg}
        </div>
      )}
      <form onSubmit={handleRunFreeTest} className="mt-8 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Exact Business Name (GBP Title)
          </label>
          <input
            type="text"
            required
            placeholder="e.g., Polk Rapid Plumbing LLC"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Search Keyword
            </label>
            <input
              type="text"
              required
              placeholder="e.g., plumber near me"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Target City, State or ZIP
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Lakeland, FL"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Work Email (To Save Your Teaser Report)
          </label>
          <input
            type="email"
            required
            placeholder="you@agency.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-sm"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Spinning up DuoPlus Cloud Phone & Running 3×3 Grid...
            </>
          ) : (
            <>
              Run Free 3×3 Rank Test Now
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      </form>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-6 border-t border-slate-800/80 pt-4">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Real DuoPlus
          Mobile Device
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Residential
          Proxy Verified
        </span>
        <span className="flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5 text-emerald-400" /> 100% Free No Credit
          Card Required
        </span>
      </div>
    </div>
  );
}
