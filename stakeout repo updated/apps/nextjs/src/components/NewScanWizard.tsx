// apps/nextjs/src/components/NewScanWizard.tsx
'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Smartphone,
  Monitor,
  Sparkles,
  Calendar,
  Coins,
  AlertCircle,
  ArrowRight,
  Loader2,
  MapPin,
  Search,
  Cpu,
} from 'lucide-react';
import { IspSelectorDropdown } from '@/components/IspSelectorDropdown';
import { CreditTopUpModal } from '@/components/CreditTopUpModal';
import { IspPreset } from '@/lib/ispDirectory';
type TargetType =
  'mobile_maps' | 'mobile_chrome' | 'mobile_google' | 'desktop_aimode';
const PHONE_MODELS: Record<string, string[]> = {
  Samsung: ['Galaxy S23 Ultra', 'Galaxy S24+', 'Galaxy Z Fold5'],
  Google: ['Pixel 8 Pro', 'Pixel 7', 'Pixel 8a'],
  Motorola: ['Moto Edge 40', 'Moto G Stylus 5G'],
  Xiaomi: ['Xiaomi 13 Pro', 'Redmi Note 12'],
};
const GRID_SIZES = [
  { size: 3, label: '3×3 (9 Pins)' },
  { size: 5, label: '5×5 (25 Pins)' },
  { size: 7, label: '7×7 (49 Pins)' },
  { size: 9, label: '9×9 (81 Pins)' },
  { size: 11, label: '11×11 (121 Pins)' },
];
const SPACING_OPTIONS = [
  { label: '0.5 Miles', km: 0.80467 },
  { label: '1.0 Mile', km: 1.60934 },
  { label: '2.0 Miles', km: 3.21868 },
  { label: '5.0 Miles', km: 8.04672 },
];
export function NewScanWizard() {
  const router = useRouter();
  // All 8 User Inputs
  const [targetType, setTargetType] = useState<TargetType>('mobile_maps');
  const [keyword, setKeyword] = useState('emergency plumber');
  const [targetBusiness, setTargetBusiness] = useState('');
  const [centerLat, setCenterLat] = useState<number>(28.039465);
  const [centerLng, setCenterLng] = useState<number>(-81.949804);
  const [phoneBrand, setPhoneBrand] = useState<string>('Samsung');
  const [phoneModel, setPhoneModel] = useState<string>('Galaxy S23 Ultra');
  const [gridSize, setGridSize] = useState<number>(7);
  const [spacingKm, setSpacingKm] = useState<number>(1.60934);
  const [trackAiOverviews, setTrackAiOverviews] = useState<boolean>(true);
  const [scheduleType, setScheduleType] = useState<'once' | 'daily' | 'weekly'>(
    'once',
  );
  // Market & ISP State
  const [detectedZip, setDetectedZip] = useState('33801');
  const [detectedCity, setDetectedCity] = useState('Lakeland');
  const [detectedState, setDetectedState] = useState('FL');
  const [ispKey, setIspKey] = useState<IspPreset['key']>('spectrum');
  const [psIspCode, setPsIspCode] = useState<string>('Charter Communications');
  // Session & UI State
  const [userId, setUserId] = useState<string>('');
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const submissionKey = useRef<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const previewMarkersRef = useRef<maplibregl.Marker[]>([]);
  // 1. Load Authenticated User via /api/user/me
  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/user/me', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.id) setUserId(data.id);
          if (typeof data.creditBalance === 'number') {
            setCreditBalance(data.creditBalance);
          }
        }
      } catch {}
    }
    loadUser();
  }, []);
  // 2. Auto-detect local ZIP/City/State when coordinates move
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/isps?lat=${centerLat}&lng=${centerLng}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.detectedMarket) {
          setDetectedZip(data.detectedMarket.zip);
          setDetectedCity(data.detectedMarket.city);
          setDetectedState(data.detectedMarket.stateCode);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [centerLat, centerLng]);
  // 3. Preview Coordinate Matrix
  const previewPoints = useMemo(() => {
    const half = Math.floor(gridSize / 2);
    const latDelta = (spacingKm / 6371.0) * (180.0 / Math.PI);
    const lngDelta = latDelta / Math.cos((centerLat * Math.PI) / 180.0);
    const pts = [];
    for (let r = -half; r <= half; r++) {
      for (let c = -half; c <= half; c++) {
        pts.push({
          lat: Number((centerLat - r * latDelta).toFixed(6)),
          lng: Number((centerLng + c * lngDelta).toFixed(6)),
          isCenter: r === 0 && c === 0,
        });
      }
    }
    return pts;
  }, [centerLat, centerLng, gridSize, spacingKm]);
  // 4. Credit Cost Calculation (Base + AI Overview Add-on)
  const creditSummary = useMemo(() => {
    const totalPins = gridSize * gridSize;
    const isDesktop = targetType.startsWith('desktop_');
    const baseCost = isDesktop ? 2 : 1;
    const aiAddon = !isDesktop && trackAiOverviews ? 1 : 0;
    const costPerPin = baseCost + aiAddon;
    const totalCost = totalPins * costPerPin;
    const spanMiles = ((gridSize - 1) * spacingKm * 0.621371).toFixed(1);
    return {
      totalPins,
      costPerPin,
      totalCost,
      spanMiles,
      hasEnoughCredits: creditBalance >= totalCost,
    };
  }, [gridSize, spacingKm, targetType, trackAiOverviews, creditBalance]);
  // 5. MapLibre Initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style:
          process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
          'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [centerLng, centerLat],
        zoom: 11.5,
        attributionControl: { compact: true },
      });
    } catch {
      setErrorMsg(
        'Map unavailable. Search for a location or enter the center coordinates.',
      );
      return;
    }
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.on('click', (e) => {
      setCenterLat(Number(e.lngLat.lat.toFixed(6)));
      setCenterLng(Number(e.lngLat.lng.toFixed(6)));
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);
  // 6. Render Preview Pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    previewMarkersRef.current.forEach((m) => m.remove());
    previewMarkersRef.current = [];
    const bounds = new maplibregl.LngLatBounds();
    previewPoints.forEach((pt) => {
      bounds.extend([pt.lng, pt.lat]);
      const el = document.createElement('div');
      if (pt.isCenter) {
        el.className =
          'flex h-7 w-7 cursor-grab items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-xs';
        el.innerText = '★';
      } else {
        el.className =
          'flex h-4 w-4 items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-500/25';
      }
      const marker = new maplibregl.Marker({
        element: el,
        draggable: pt.isCenter,
        anchor: 'center',
      })
        .setLngLat([pt.lng, pt.lat])
        .addTo(map);
      if (pt.isCenter) {
        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          setCenterLat(Number(lngLat.lat.toFixed(6)));
          setCenterLng(Number(lngLat.lng.toFixed(6)));
        });
      }
      previewMarkersRef.current.push(marker);
    });
    if (previewPoints.length > 1) {
      map.fitBounds(bounds, { padding: 65, maxZoom: 14, duration: 400 });
    }
  }, [previewPoints]);
  async function handleGeocodeSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!addressQuery.trim()) return;
    setIsGeocoding(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(
          addressQuery,
        )}`,
      );
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        setCenterLat(Number(Number(results[0].lat).toFixed(6)));
        setCenterLng(Number(Number(results[0].lon).toFixed(6)));
      } else {
        setErrorMsg(
          'Address not found. Click directly on the map to position pins.',
        );
      }
    } catch {
      setErrorMsg('Address lookup failed.');
    } finally {
      setIsGeocoding(false);
    }
  }
  async function handleLaunchScan(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!keyword.trim() || !targetBusiness.trim()) {
      setErrorMsg('Enter both a target business name and search query.');
      return;
    }
    if (!creditSummary.hasEnoughCredits) {
      setIsTopUpOpen(true);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/scans/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': (submissionKey.current ??= crypto.randomUUID()),
        },
        body: JSON.stringify({
          keyword: keyword.trim(),
          targetBusiness: targetBusiness.trim(),
          centerLat,
          centerLng,
          ispId: psIspCode,
          gridSize,
          spacingKm,
          targetType,
          phoneBrand,
          phoneModel,
          trackAiOverviews,
          scheduleType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status < 500) submissionKey.current = null;
        throw new Error(data.error ?? 'Failed to launch scan');
      }
      router.push(`/scans/${data.scanId}`);
    } catch (err: any) {
      setErrorMsg(err.message);
      setIsSubmitting(false);
    }
  }
  const aiAddonLabel =
    targetType === 'mobile_maps'
      ? 'Track "Ask Maps" Generative AI Cards (+1 Cr/Pin)'
      : 'Track Google AI Overviews & Citations (+1 Cr/Pin)';
  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full flex-col lg:h-[calc(100vh-4rem)] lg:overflow-hidden bg-slate-950 text-slate-100 lg:flex-row">
      {/* LEFT PANEL: ALL 8 CONFIGURATION INPUTS */}
      <div className="flex w-full flex-col justify-between overflow-y-auto lg:w-[430px] lg:shrink-0 border-r border-slate-800 bg-slate-900/95">
        <form onSubmit={handleLaunchScan} className="space-y-5 p-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-lg font-extrabold text-white">
                Stakeout GeoGrid Launcher
              </h1>
              <p className="text-xs text-slate-400">
                Real DuoPlus Cloud Phones • Residential ISP • AI Overviews
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsTopUpOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5"
            >
              <Coins className="h-4 w-4 text-emerald-400" />
              <div>
                <div className="text-[10px] uppercase text-emerald-400">
                  {creditBalance.toLocaleString()} Credits
                </div>
                <div className="text-xs font-bold text-white underline">
                  + Top Up
                </div>
              </div>
            </button>
          </div>
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {/* 1. Target App */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              1. Target Mobile App Surface
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  id: 'mobile_maps',
                  title: 'Google Maps App',
                  sub: 'Local Pack & Ask Maps',
                },
                {
                  id: 'mobile_chrome',
                  title: 'Google Chrome',
                  sub: 'Mobile Web + AI Overviews',
                },
                {
                  id: 'mobile_google',
                  title: 'Google App',
                  sub: 'Search Widget + AI Overviews',
                },
                {
                  id: 'desktop_aimode',
                  title: 'Desktop + AI Mode',
                  sub: 'CloakBrowser (&udm=50)',
                },
              ]
                .filter(
                  (item) =>
                    item.id !== 'desktop_aimode' ||
                    process.env.NEXT_PUBLIC_DESKTOP_ENABLED === 'true',
                )
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTargetType(item.id as TargetType)}
                    className={`rounded-lg border p-2.5 text-left transition ${
                      targetType === item.id
                        ? 'border-emerald-500 bg-emerald-500/15 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-100">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-400">{item.sub}</div>
                  </button>
                ))}
            </div>
          </div>
          {/* 2. Search Query & Business Name */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                2A. Exact Business Name (GBP)
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Polk Rapid Plumbing"
                value={targetBusiness}
                onChange={(e) => setTargetBusiness(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                2B. Search Query
              </label>
              <input
                type="text"
                required
                placeholder="e.g., plumber near me"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>
          {/* 4 & 5. Brand & Model of Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                4. Phone Brand
              </label>
              <select
                value={phoneBrand}
                onChange={(e) => {
                  const b = e.target.value;
                  setPhoneBrand(b);
                  setPhoneModel(PHONE_MODELS[b]?.[0] ?? 'Galaxy S23 Ultra');
                }}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                {Object.keys(PHONE_MODELS).map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                5. Phone Model
              </label>
              <select
                value={phoneModel}
                onChange={(e) => setPhoneModel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                {(PHONE_MODELS[phoneBrand] ?? []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* 6. Size of Map Grid & Spacing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                6. Grid Matrix Size
              </label>
              <select
                value={gridSize}
                onChange={(e) => setGridSize(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                {GRID_SIZES.map((g) => (
                  <option key={g.size} value={g.size}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Pin Spacing
              </label>
              <select
                value={spacingKm}
                onChange={(e) => setSpacingKm(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                {SPACING_OPTIONS.map((s) => (
                  <option key={s.label} value={s.km}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Residential ISP Selector */}
          <IspSelectorDropdown
            stateCode={detectedState}
            city={detectedCity}
            zip={detectedZip}
            value={ispKey}
            onChange={(key, code) => {
              setIspKey(key);
              setPsIspCode(code);
            }}
          />
          {/* 7. Add-On: Track AI Overviews / Ask Maps */}
          <div className="rounded-xl border border-purple-500/30 bg-purple-950/15 p-3.5">
            <label className="flex cursor-pointer items-center justify-between">
              <div className="space-y-0.5 pr-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-200">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  7. {aiAddonLabel}
                </div>
                <div className="text-[11px] text-slate-400">
                  Capture the AI panel, its text, and visible sources at each
                  grid point.
                </div>
              </div>
              <input
                type="checkbox"
                checked={trackAiOverviews}
                onChange={(e) => setTrackAiOverviews(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-purple-500"
              />
            </label>
          </div>
          {/* 8. Automation Schedule */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              8. Search Execution Schedule
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'once', label: 'Run Once Now' },
                { id: 'daily', label: 'Daily (8 AM EST)' },
                { id: 'weekly', label: 'Weekly (Mondays)' },
              ].map((sch) => (
                <button
                  key={sch.id}
                  type="button"
                  onClick={() => setScheduleType(sch.id as any)}
                  className={`rounded-lg border py-2 px-2.5 text-xs font-bold transition ${
                    scheduleType === sch.id
                      ? 'border-emerald-500 bg-emerald-500/20 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {sch.label}
                </button>
              ))}
            </div>
          </div>
          {/* 3. Center Coordinates Display & Launch Button */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                3. Center Lat/Lng ({detectedCity}, {detectedState}):
              </span>
              <span className="flex gap-1">
                <input
                  aria-label="Center latitude"
                  type="number"
                  step="any"
                  min="-85"
                  max="85"
                  className="w-24 bg-slate-800 p-1"
                  value={centerLat}
                  onChange={(e) => setCenterLat(Number(e.target.value))}
                />
                <input
                  aria-label="Center longitude"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  className="w-24 bg-slate-800 p-1"
                  value={centerLng}
                  onChange={(e) => setCenterLng(Number(e.target.value))}
                />
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 pt-2.5">
              <span className="text-sm font-bold text-white">
                Total Cost ({creditSummary.totalPins} pins ×{' '}
                {creditSummary.costPerPin} cr):
              </span>
              <span className="text-base font-extrabold text-emerald-400">
                {creditSummary.totalCost} Credits
              </span>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Provisioning {creditSummary.totalPins} Pins...
                </>
              ) : creditSummary.hasEnoughCredits ? (
                <>
                  Launch {gridSize}×{gridSize} Stakeout Scan (
                  {creditSummary.totalCost} Cr)
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Top Up Credits to Launch ({creditSummary.totalCost} Cr Needed)
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      {/* RIGHT PANEL: INTERACTIVE MAPLIBRE CANVAS */}
      <div className="relative min-h-80 flex-1 bg-slate-950">
        <div className="pointer-events-auto absolute left-5 right-5 top-5 z-20 max-w-md">
          <form
            onSubmit={handleGeocodeSearch}
            className="flex items-center overflow-hidden rounded-xl border border-slate-700 bg-slate-900/95 shadow-2xl"
          >
            <MapPin className="ml-3.5 h-4 w-4 shrink-0 text-emerald-400" />
            <input
              type="text"
              placeholder="Search address, city, or ZIP to center grid..."
              value={addressQuery}
              onChange={(e) => setAddressQuery(e.target.value)}
              className="w-full bg-transparent px-3 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isGeocoding}
              className="border-l border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-emerald-400"
            >
              {isGeocoding ? '...' : <Search className="h-4 w-4" />}
            </button>
          </form>
        </div>
        <div ref={mapContainerRef} className="absolute inset-0" />
      </div>
      <CreditTopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        userId={userId}
        currentBalance={creditBalance}
        onBalanceUpdated={(newBal) => setCreditBalance(newBal)}
      />
    </div>
  );
}
