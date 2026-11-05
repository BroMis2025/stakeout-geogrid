// apps/nextjs/src/components/GeoGridCompareView.tsx
'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Video,
  Calendar,
  ArrowRight,
  Share2,
  Check,
  X,
  RefreshCw,
  Layers,
  Trophy,
  Activity,
  BarChart3,
  Lock,
  Unlock,
} from 'lucide-react';
import type { GridPinData, GridScanData } from './GeoGridDashboard';
interface CampaignHistoryItem {
  id: string;
  createdAt: string;
  solv: number | null;
  atrp: number | null;
  arp: number | null;
  aioCitationRate: number | null;
  gridSize: number;
}
export interface PairedPinDelta {
  key: string; // "${rowIdx}_${colIdx}"
  rowIdx: number;
  colIdx: number;
  lat: number;
  lng: number;
  zip: string;
  city: string;
  stateCode: string;
  pinA: GridPinData | null;
  pinB: GridPinData | null;
  rankA: number; // 1..20 or 21 if unranked
  rankB: number; // 1..20 or 21 if unranked
  rankDelta: number; // Positive = improved (e.g. rankA 12 - rankB 4 = +8)
  aiStatus: 'GAINED' | 'LOST' | 'RETAINED' | 'NONE';
}
function getStandardRankStyle(rankFound: number | null | undefined) {
  if (rankFound != null && rankFound >= 1 && rankFound <= 3) {
    return {
      bg: '#10b981',
      border: '#a7f3d0',
      text: '#022c22',
      label: String(rankFound),
    };
  }
  if (rankFound != null && rankFound >= 4 && rankFound <= 10) {
    return {
      bg: '#f59e0b',
      border: '#fde68a',
      text: '#451a03',
      label: String(rankFound),
    };
  }
  if (rankFound != null && rankFound >= 11 && rankFound <= 20) {
    return {
      bg: '#ef4444',
      border: '#fecaca',
      text: '#ffffff',
      label: String(rankFound),
    };
  }
  return { bg: '#334155', border: '#64748b', text: '#cbd5e1', label: '20+' };
}
function getAfterPinStyle(
  pair: PairedPinDelta,
  badgeMode: 'delta' | 'rank' | 'ai',
): { bg: string; border: string; text: string; label: string } {
  if (pair.pinA?.status !== 'COMPLETED' || pair.pinB?.status !== 'COMPLETED')
    return { bg: '#334155', border: '#64748b', text: '#fff', label: 'N/A' };
  if (badgeMode === 'rank') {
    return getStandardRankStyle(pair.pinB?.rankFound);
  }
  if (badgeMode === 'ai') {
    if (pair.aiStatus === 'GAINED') {
      return {
        bg: '#9333ea',
        border: '#e9d5ff',
        text: '#ffffff',
        label: '+AI',
      };
    }
    if (pair.aiStatus === 'RETAINED') {
      return { bg: '#6b21a8', border: '#c084fc', text: '#f3e8ff', label: 'AI' };
    }
    if (pair.aiStatus === 'LOST') {
      return {
        bg: '#dc2626',
        border: '#fecaca',
        text: '#ffffff',
        label: '-AI',
      };
    }
    return { bg: '#1e293b', border: '#475569', text: '#64748b', label: '—' };
  }
  // Default: 'delta' mode
  if (pair.rankA === 21 && pair.rankB <= 20) {
    return { bg: '#10b981', border: '#a7f3d0', text: '#022c22', label: `NEW` };
  }
  if (pair.rankDelta > 0) {
    return {
      bg: '#10b981',
      border: '#a7f3d0',
      text: '#022c22',
      label: `+${pair.rankDelta}`,
    };
  }
  if (pair.rankDelta < 0) {
    return {
      bg: '#ef4444',
      border: '#fecaca',
      text: '#ffffff',
      label: `${pair.rankDelta}`,
    };
  }
  if (pair.rankB <= 20) {
    return {
      bg: '#0284c7',
      border: '#bae6fd',
      text: '#ffffff',
      label: `=${pair.rankB}`,
    };
  }
  return { bg: '#334155', border: '#64748b', text: '#94a3b8', label: '20+' };
}
export function GeoGridCompareView({
  initialScanAId,
  initialScanBId,
  isPublic = false,
}: {
  initialScanAId?: string;
  initialScanBId?: string;
  isPublic?: boolean;
}) {
  const router = useRouter();
  const [scanA, setScanA] = useState<GridScanData | null>(null);
  const [scanB, setScanB] = useState<GridScanData | null>(null);
  const [history, setHistory] = useState<CampaignHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [badgeMode, setBadgeMode] = useState<'delta' | 'rank' | 'ai'>('delta');
  const [syncMaps, setSyncMaps] = useState<boolean>(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  // Dual MapLibre Refs
  const mapAContainerRef = useRef<HTMLDivElement | null>(null);
  const mapBContainerRef = useRef<HTMLDivElement | null>(null);
  const mapARef = useRef<maplibregl.Map | null>(null);
  const mapBRef = useRef<maplibregl.Map | null>(null);
  const markersARef = useRef<maplibregl.Marker[]>([]);
  const markersBRef = useRef<maplibregl.Marker[]>([]);
  const isSyncingRef = useRef<boolean>(false);
  // 1. Load Scan A, Scan B & Campaign History
  useEffect(() => {
    async function fetchComparison() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const params = new URLSearchParams();
        if (initialScanAId) params.set('a', initialScanAId);
        if (initialScanBId) params.set('b', initialScanBId);
        if (isPublic) params.set('public', '1');
        const res = await fetch(`/api/scans/compare?${params.toString()}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to load comparison');
        setScanA(data.scanA);
        setScanB(data.scanB);
        setHistory(data.campaignHistory ?? []);
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchComparison();
  }, [initialScanAId, initialScanBId, isPublic]);
  // 2. Pair Pins by (rowIdx, colIdx) & Compute Pin-by-Pin Deltas
  const pairedPins = useMemo<PairedPinDelta[]>(() => {
    if (!scanA || !scanB) return [];
    const mapA = new Map<string, GridPinData>();
    scanA.pins.forEach((p) => mapA.set(`${p.rowIdx}_${p.colIdx}`, p));
    const mapB = new Map<string, GridPinData>();
    scanB.pins.forEach((p) => mapB.set(`${p.rowIdx}_${p.colIdx}`, p));
    const allKeys = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));
    return allKeys.map((key) => {
      const pinA = mapA.get(key) ?? null;
      const pinB = mapB.get(key) ?? null;
      const refPin = (pinB || pinA)!;
      const rankA =
        pinA?.rankFound != null && pinA.rankFound <= 20 ? pinA.rankFound : 21;
      const rankB =
        pinB?.rankFound != null && pinB.rankFound <= 20 ? pinB.rankFound : 21;
      // Positive rankDelta = climbed closer to #1 (e.g., 14 -> 3 = +11)
      const rankDelta =
        pinA?.status === 'COMPLETED' && pinB?.status === 'COMPLETED'
          ? rankA - rankB
          : 0;
      const citedA = Boolean(pinA?.targetCitedInAi);
      const citedB = Boolean(pinB?.targetCitedInAi);
      let aiStatus: PairedPinDelta['aiStatus'] = 'NONE';
      if (pinA?.status !== 'COMPLETED' || pinB?.status !== 'COMPLETED')
        aiStatus = 'NONE';
      else if (!citedA && citedB) aiStatus = 'GAINED';
      else if (citedA && !citedB) aiStatus = 'LOST';
      else if (citedA && citedB) aiStatus = 'RETAINED';
      return {
        key,
        rowIdx: refPin.rowIdx,
        colIdx: refPin.colIdx,
        lat: refPin.lat,
        lng: refPin.lng,
        zip: refPin.zip,
        city: refPin.city,
        stateCode: refPin.stateCode,
        pinA,
        pinB,
        rankA,
        rankB,
        rankDelta,
        aiStatus,
      };
    });
  }, [scanA, scanB]);
  const selectedPair = useMemo(
    () => pairedPins.find((p) => p.key === selectedKey) ?? null,
    [pairedPins, selectedKey],
  );
  // 3. Summary Campaign Delta Rollup
  const deltaSummary = useMemo(() => {
    if (!scanA || !scanB) return null;
    const solvA = scanA.solv ?? 0;
    const solvB = scanB.solv ?? 0;
    const solvDiff = Number((solvB - solvA).toFixed(1));
    const atrpA = scanA.atrp ?? 21;
    const atrpB = scanB.atrp ?? 21;
    // Lower ATRP is better
    const atrpDiff = Number((atrpB - atrpA).toFixed(2));
    const aioA = scanA.aioCitationRate ?? 0;
    const aioB = scanB.aioCitationRate ?? 0;
    const aioDiff = Number((aioB - aioA).toFixed(1));
    const pinsImproved = pairedPins.filter((p) => p.rankDelta > 0).length;
    const pinsDeclined = pairedPins.filter((p) => p.rankDelta < 0).length;
    const pinsNewTop3 = pairedPins.filter(
      (p) =>
        p.pinA?.status === 'COMPLETED' &&
        p.pinB?.status === 'COMPLETED' &&
        p.rankA > 3 &&
        p.rankB <= 3,
    ).length;
    const pinsGainedAi = pairedPins.filter(
      (p) => p.aiStatus === 'GAINED',
    ).length;
    return {
      solvA,
      solvB,
      solvDiff,
      atrpA,
      atrpB,
      atrpDiff,
      aioA,
      aioB,
      aioDiff,
      pinsImproved,
      pinsDeclined,
      pinsNewTop3,
      pinsGainedAi,
    };
  }, [scanA, scanB, pairedPins]);
  // 4. Initialize Dual MapLibre Canvases with Lockstep Camera Sync
  useEffect(() => {
    if (
      !scanA ||
      !scanB ||
      !mapAContainerRef.current ||
      !mapBContainerRef.current ||
      mapARef.current ||
      mapBRef.current
    ) {
      return;
    }
    let mapA: maplibregl.Map, mapB: maplibregl.Map;
    try {
      mapA = new maplibregl.Map({
        container: mapAContainerRef.current,
        style:
          process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
          'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [scanA.centerLng, scanA.centerLat],
        zoom: 11.5,
        attributionControl: { compact: true },
      });
      mapB = new maplibregl.Map({
        container: mapBContainerRef.current,
        style:
          process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
          'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [scanB.centerLng, scanB.centerLat],
        zoom: 11.5,
        attributionControl: { compact: true },
      });
    } catch {
      return;
    }
    mapA.addControl(new maplibregl.NavigationControl(), 'bottom-left');
    mapB.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    mapARef.current = mapA;
    mapBRef.current = mapB;
    return () => {
      mapA.remove();
      mapB.remove();
      mapARef.current = null;
      mapBRef.current = null;
    };
  }, [scanA?.id, scanB?.id]);
  // 5. Bind Camera Lockstep Listener
  useEffect(() => {
    const mapA = mapARef.current;
    const mapB = mapBRef.current;
    if (!mapA || !mapB) return;
    const syncFromAToB = () => {
      if (!syncMaps || isSyncingRef.current) return;
      isSyncingRef.current = true;
      mapB.jumpTo({
        center: mapA.getCenter(),
        zoom: mapA.getZoom(),
        bearing: mapA.getBearing(),
        pitch: mapA.getPitch(),
      });
      isSyncingRef.current = false;
    };
    const syncFromBToA = () => {
      if (!syncMaps || isSyncingRef.current) return;
      isSyncingRef.current = true;
      mapA.jumpTo({
        center: mapB.getCenter(),
        zoom: mapB.getZoom(),
        bearing: mapB.getBearing(),
        pitch: mapB.getPitch(),
      });
      isSyncingRef.current = false;
    };
    mapA.on('move', syncFromAToB);
    mapB.on('move', syncFromBToA);
    return () => {
      mapA.off('move', syncFromAToB);
      mapB.off('move', syncFromBToA);
    };
  }, [syncMaps, scanA?.id, scanB?.id]);
  // 6. Render Paired Markers on Both Maps
  useEffect(() => {
    const mapA = mapARef.current;
    const mapB = mapBRef.current;
    if (!mapA || !mapB || pairedPins.length === 0) return;
    markersARef.current.forEach((m) => m.remove());
    markersBRef.current.forEach((m) => m.remove());
    markersARef.current = [];
    markersBRef.current = [];
    const bounds = new maplibregl.LngLatBounds();
    pairedPins.forEach((pair) => {
      bounds.extend([pair.lng, pair.lat]);
      const isSelected = selectedKey === pair.key;
      // ---- Marker A (Baseline / Before) ----
      const styleA = getStandardRankStyle(pair.pinA?.rankFound);
      if (pair.pinA?.status !== 'COMPLETED') styleA.label = 'N/A';
      const elA = document.createElement('button');
      elA.type = 'button';
      elA.className =
        'flex items-center justify-center rounded-full font-bold transition-transform focus:outline-none';
      elA.style.width = isSelected ? '40px' : '32px';
      elA.style.height = isSelected ? '40px' : '32px';
      elA.style.backgroundColor = styleA.bg;
      elA.style.border = `${isSelected ? '3px' : '2px'} solid ${
        isSelected ? '#ffffff' : styleA.border
      }`;
      elA.style.color = styleA.text;
      elA.style.fontSize = '11px';
      elA.style.boxShadow = pair.pinA?.targetCitedInAi
        ? '0 0 0 3px #a855f7'
        : '0 4px 10px rgba(0,0,0,0.45)';
      elA.innerText = styleA.label;
      elA.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedKey(pair.key);
      });
      const mA = new maplibregl.Marker({ element: elA, anchor: 'center' })
        .setLngLat([pair.lng, pair.lat])
        .addTo(mapA);
      markersARef.current.push(mA);
      // ---- Marker B (Current / After with Delta Badge) ----
      const styleB = getAfterPinStyle(pair, badgeMode);
      const elB = document.createElement('button');
      elB.type = 'button';
      elB.className =
        'flex items-center justify-center rounded-full font-extrabold transition-transform focus:outline-none';
      elB.style.width = isSelected ? '40px' : '32px';
      elB.style.height = isSelected ? '40px' : '32px';
      elB.style.backgroundColor = styleB.bg;
      elB.style.border = `${isSelected ? '3px' : '2px'} solid ${
        isSelected ? '#ffffff' : styleB.border
      }`;
      elB.style.color = styleB.text;
      elB.style.fontSize = '11px';
      elB.style.boxShadow = pair.pinB?.targetCitedInAi
        ? '0 0 0 3px #a855f7, 0 0 12px rgba(168,85,247,0.7)'
        : '0 4px 10px rgba(0,0,0,0.45)';
      elB.innerText = styleB.label;
      elB.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedKey(pair.key);
      });
      const mB = new maplibregl.Marker({ element: elB, anchor: 'center' })
        .setLngLat([pair.lng, pair.lat])
        .addTo(mapB);
      markersBRef.current.push(mB);
    });
    if (pairedPins.length > 1 && !selectedKey) {
      mapA.fitBounds(bounds, { padding: 60, maxZoom: 13.5, duration: 0 });
      mapB.fitBounds(bounds, { padding: 60, maxZoom: 13.5, duration: 0 });
    }
  }, [pairedPins, badgeMode, selectedKey]);
  async function handleCopyPublicCompareUrl() {
    if (typeof window === 'undefined' || !scanA || !scanB) return;
    if (isPublic) {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      return;
    }
    const links = await Promise.all(
      [scanA, scanB].map(async (scan) => {
        const r = await fetch('/api/scans/' + scan.id, {
          method: 'POST',
          body: JSON.stringify({ action: 'share' }),
        });
        if (!r.ok) throw new Error('Could not share report.');
        return (await r.json()).path.split('/').pop();
      }),
    );
    await navigator.clipboard.writeText(
      window.location.origin +
        '/share/compare?a=' +
        links[0] +
        '&b=' +
        links[1],
    );
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  }
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-300">
        <RefreshCw className="mr-3 h-5 w-5 animate-spin text-emerald-400" />
        Synchronizing Stakeout Before & After GeoGrid Matrices...
      </div>
    );
  }
  if (errorMsg || !scanA || !scanB || !deltaSummary) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 text-slate-400">
        <p className="text-base font-bold text-white">Comparison Unavailable</p>
        <p className="mt-1 text-xs">
          {errorMsg ?? 'Select two scans to compare.'}
        </p>
      </div>
    );
  }
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* =================================================================== */}
      {/* TOP BAR: CAMPAIGN IDENTITY, RUN SELECTORS & DELTA KPI STRIP         */}
      {/* =================================================================== */}
      <div className="z-20 border-b border-slate-800 bg-slate-900/95 px-6 py-3.5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Campaign Title & Run Date Pickers */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded bg-emerald-500/15 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider">
                Stakeout Delta Engine
              </span>
              <h1 className="text-base font-extrabold text-white">
                &ldquo;{scanB.keyword}&rdquo;
              </h1>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-sm font-bold text-emerald-300">
                {scanB.targetBusiness}
              </span>
            </div>
            {/* Run A vs Run B Selector Dropdowns */}
            {!isPublic && history.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400">Baseline (Before):</span>
                <select
                  value={scanA.id}
                  onChange={(e) =>
                    router.push(
                      `/scans/compare?a=${e.target.value}&b=${scanB.id}`,
                    )
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-200"
                >
                  {history.map((h) => (
                    <option key={h.id} value={h.id}>
                      {new Date(h.createdAt).toLocaleDateString()} — SoLV:{' '}
                      {h.solv?.toFixed(1) ?? 0}%
                    </option>
                  ))}
                </select>
                <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-slate-400">Current (After):</span>
                <select
                  value={scanB.id}
                  onChange={(e) =>
                    router.push(
                      `/scans/compare?a=${scanA.id}&b=${e.target.value}`,
                    )
                  }
                  className="rounded-lg border border-emerald-500/50 bg-slate-950 px-2.5 py-1 text-xs font-semibold"
                >
                  {history.map((h) => (
                    <option key={h.id} value={h.id}>
                      {new Date(h.createdAt).toLocaleDateString()} — SoLV:{' '}
                      {h.solv?.toFixed(1) ?? 0}%
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {/* Center: After-Map Pin Mode Switcher & Camera Lock Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1">
              {[
                { id: 'delta', label: 'Pin Deltas (+5 / -2)' },
                { id: 'rank', label: 'Absolute Ranks' },
                { id: 'ai', label: 'AI Citation Shifts' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setBadgeMode(m.id as any)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    badgeMode === m.id
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSyncMaps((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                syncMaps
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-800 bg-slate-950 text-slate-400'
              }`}
              title="Lock or unlock synchronized pan/zoom between maps"
            >
              {syncMaps ? (
                <>
                  <Lock className="h-3.5 w-3.5" /> Synced Pan
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5" /> Free Pan
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                handleCopyPublicCompareUrl().catch(() =>
                  setErrorMsg('Could not copy the comparison link.'),
                )
              }
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs"
            >
              {copiedShare ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied Link
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5 text-emerald-400" /> Share
                  Delta
                </>
              )}
            </button>
          </div>
          {/* Right: Headline Delta Scorecards */}
          <div className="flex items-center gap-2.5">
            {/* SoLV Shift Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                SoLV (Top 3) Shift
              </div>
              <div className="mt-0.5 flex items-center justify-center gap-1.5">
                <span className="text-sm font-bold text-slate-300">
                  {deltaSummary.solvA.toFixed(1)}% →{' '}
                  {deltaSummary.solvB.toFixed(1)}%
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-extrabold ${
                    deltaSummary.solvDiff > 0
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : deltaSummary.solvDiff < 0
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {deltaSummary.solvDiff > 0
                    ? `+${deltaSummary.solvDiff}%`
                    : `${deltaSummary.solvDiff}%`}
                </span>
              </div>
            </div>
            {/* ATRP Shift Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                ATRP Avg Rank
              </div>
              <div className="mt-0.5 flex items-center justify-center gap-1.5">
                <span className="text-sm font-bold text-slate-300">
                  {deltaSummary.atrpA.toFixed(1)} →{' '}
                  {deltaSummary.atrpB.toFixed(1)}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-extrabold ${
                    deltaSummary.atrpDiff < 0
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : deltaSummary.atrpDiff > 0
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {deltaSummary.atrpDiff < 0
                    ? `${deltaSummary.atrpDiff} ▲`
                    : deltaSummary.atrpDiff > 0
                      ? `+${deltaSummary.atrpDiff} ▼`
                      : '0.0'}
                </span>
              </div>
            </div>
            {/* Pins Improved vs Declined Pill */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />{' '}
                {deltaSummary.pinsImproved} Pins Climbed
              </div>
              <div className="mt-0.5 flex items-center gap-2 font-semibold text-red-400">
                <TrendingDown className="h-3.5 w-3.5" />{' '}
                {deltaSummary.pinsDeclined} Pins Dropped
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* =================================================================== */}
      <label className="flex items-center gap-3 bg-slate-900 px-5 py-2 text-xs">
        Inspect a paired pin
        <select
          className="rounded bg-slate-800 px-2 py-1"
          value={selectedKey ?? ''}
          onChange={(e) => setSelectedKey(e.target.value || null)}
        >
          <option value="">Choose a coordinate</option>
          {pairedPins.map((p) => (
            <option key={p.key} value={p.key}>
              Row {p.rowIdx + 1}, col {p.colIdx + 1} · {p.lat}, {p.lng}
            </option>
          ))}
        </select>
      </label>
      {/* SPLIT-SCREEN DUAL MAPLIBRE VIEWPORTS (BEFORE vs AFTER)              */}
      {/* =================================================================== */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* LEFT MAP: SCAN A (BASELINE / BEFORE) */}
        <div className="relative h-full w-1/2 border-r border-slate-800">
          <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-slate-700">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              BASELINE (BEFORE)
            </div>
            <div className="text-sm font-bold text-white">
              {new Date(scanA.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
            <div className="mt-0.5 text-xs text-slate-300">
              SoLV:{' '}
              <strong className="text-emerald-400">
                {deltaSummary.solvA.toFixed(1)}%
              </strong>{' '}
              • ATRP: <strong>{deltaSummary.atrpA.toFixed(2)}</strong>
            </div>
          </div>
          <div ref={mapAContainerRef} className="h-full w-full" />
        </div>
        {/* RIGHT MAP: SCAN B (CURRENT / AFTER WITH DELTA BADGES) */}
        <div className="relative h-full w-1/2">
          <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-emerald-500/40">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
              CURRENT (AFTER • {badgeMode.toUpperCase()} VIEW)
            </div>
            <div className="text-sm font-bold text-white">
              {new Date(scanB.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
            <div className="mt-0.5 text-xs text-slate-300">
              SoLV:{' '}
              <strong className="text-emerald-400">
                {deltaSummary.solvB.toFixed(1)}%
              </strong>{' '}
              • New top-three pins: <strong>{deltaSummary.pinsNewTop3}</strong>
            </div>
          </div>
          <div ref={mapBContainerRef} className="h-full w-full" />
        </div>
        {/* ================================================================= */}
        {/* SLIDE-OVER SIDE-BY-SIDE PIN & DUAL 45s VIDEO DRAWER               */}
        {/* ================================================================= */}
        {selectedPair && (
          <div className="z-30 flex h-full w-full max-w-2xl flex-col border-l border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase text-slate-400">
                    PIN ({selectedPair.rowIdx}, {selectedPair.colIdx})
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                    ZIP {selectedPair.zip}
                  </span>
                  {selectedPair.rankDelta !== 0 && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                        selectedPair.rankDelta > 0
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-red-500 text-white'
                      }`}
                    >
                      {selectedPair.rankDelta > 0
                        ? `Climbed +${selectedPair.rankDelta} Positions`
                        : `Dropped ${selectedPair.rankDelta} Positions`}
                    </span>
                  )}
                </div>
                <h2 className="mt-1 text-base font-bold text-white">
                  {selectedPair.city}, {selectedPair.stateCode} (
                  {selectedPair.lat}, {selectedPair.lng})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKey(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Dual Side-by-Side Comparison Columns (Before vs After) */}
            <div className="grid flex-1 grid-cols-2 divide-x divide-slate-800 overflow-y-auto">
              {[
                {
                  label: 'BEFORE (BASELINE)',
                  scan: scanA,
                  pin: selectedPair.pinA,
                },
                {
                  label: 'AFTER (CURRENT)',
                  scan: scanB,
                  pin: selectedPair.pinB,
                },
              ].map((col, idx) => (
                <div key={idx} className="space-y-4 p-5">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {col.label} •{' '}
                      {new Date(col.scan.createdAt).toLocaleDateString()}
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-2xl font-extrabold text-white">
                        {col.pin?.rankFound ? `#${col.pin.rankFound}` : '20+'}
                      </span>
                      {col.pin?.hasAiOverview && (
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            col.pin.targetCitedInAi
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {col.pin.targetCitedInAi
                            ? '★ AI Cited'
                            : 'AI Not Cited'}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 45s R2 Video Player */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                      <Video className="h-3.5 w-3.5 text-emerald-400" />
                      45s Device Recording
                    </div>
                    {col.pin?.aiOverviewText && (
                      <details className="mb-2 text-xs">
                        <summary>AI panel text and sources</summary>
                        <p className="whitespace-pre-wrap">
                          {col.pin.aiOverviewText}
                        </p>
                        <p>{col.pin.aiCitations?.join(' · ')}</p>
                      </details>
                    )}
                    {col.pin?.videoUrl ? (
                      <div className="overflow-hidden rounded-xl border border-slate-800 bg-black">
                        <video
                          key={col.pin.videoUrl}
                          src={col.pin.videoUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="max-h-[280px] w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex h-36 items-center justify-center rounded-xl border border-dashed">
                        No video recorded
                      </div>
                    )}
                  </div>
                  {/* Top 10 SERP Competitors Snapshot */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Top 10 Observed SERP
                    </div>
                    <div className="space-y-1">
                      {(col.pin?.topCompetitors ?? [])
                        .slice(0, 10)
                        .map((biz, rIdx) => {
                          const r = rIdx + 1;
                          const isTarget = biz
                            .toLowerCase()
                            .includes(scanB.targetBusiness.toLowerCase());
                          return (
                            <div
                              key={`${r}-${biz}`}
                              className={`flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs ${
                                isTarget
                                  ? 'border-emerald-500/50 bg-emerald-500/15 font-bold text-white'
                                  : 'border-slate-800/80 bg-slate-950 text-slate-300'
                              }`}
                            >
                              <span className="font-mono text-[11px] text-emerald-400">
                                #{r}
                              </span>
                              <span className="truncate">{biz}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
