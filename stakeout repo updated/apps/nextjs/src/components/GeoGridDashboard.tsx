'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  CompetitorLeaderboard,
  type CompetitorMarketStat,
} from './CompetitorLeaderboard';
export type GridPinData = {
  id: string;
  rowIdx: number;
  colIdx: number;
  lat: number;
  lng: number;
  zip: string;
  city: string;
  stateCode: string;
  status: string;
  rankFound: number | null;
  topCompetitors: string[] | null;
  hasAiOverview: boolean;
  targetCitedInAi: boolean;
  aiOverviewText: string | null;
  aiCitations: string[] | null;
  videoUrl: string | null;
  metaJsonUrl?: string | null;
  dumpsTarUrl?: string | null;
  proxyMeta: {
    city: string;
    region: string;
    rungUsed: string;
    country: string;
  } | null;
};
export type GridScanData = {
  id: string;
  targetBusiness: string;
  keyword: string;
  status: string;
  createdAt: string;
  gridSize: number;
  spacingKm: number;
  centerLat: number;
  centerLng: number;
  totalPins: number;
  completedPins: number;
  failedPins: number;
  solv: number | null;
  arp: number | null;
  atrp: number | null;
  aioCitationRate: number | null;
  aioTriggerRate: number | null;
  targetType: string;
  trackAiOverviews: boolean;
  pins: GridPinData[];
};
export function GeoGridDashboard({
  identifier,
  shared = false,
}: {
  identifier: string;
  shared?: boolean;
}) {
  const [scan, setScan] = useState<GridScanData | null>(null),
    [selected, select] = useState<string | null>(null),
    [error, setError] = useState(''),
    [share, setShare] = useState(''),
    [projected, project] = useState<CompetitorMarketStat | null>(null),
    [mapWarning, setMapWarning] = useState('');
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      let retry = true;
      try {
        const r = await fetch(
            '/api/' + (shared ? 'share/' : 'scans/') + identifier,
            { cache: 'no-store' },
          ),
          d = await r.json();
        if (!r.ok) {
          if (r.status === 404 || r.status === 401) retry = false;
          throw Error(d.error);
        }
        if (alive) {
          setScan(d);
          setError('');
        }
        retry = ['QUEUED', 'RUNNING'].includes(d.status);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive && retry) timer = setTimeout(load, 5000);
      }
    }
    void load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [identifier, shared]);
  useEffect(() => {
    if (!scan || !container.current) return;
    try {
      const m = new maplibregl.Map({
        container: container.current,
        style:
          process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
          'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [scan.centerLng, scan.centerLat],
        zoom: 11,
      });
      m.addControl(new maplibregl.NavigationControl());
      map.current = m;
      const bounds = new maplibregl.LngLatBounds();
      scan.pins.forEach((p) => bounds.extend([p.lng, p.lat]));
      if (!bounds.isEmpty())
        m.fitBounds(bounds, { padding: 52, maxZoom: 14, duration: 0 });
      return () => {
        m.remove();
        map.current = null;
      };
    } catch {
      setMapWarning(
        'Map rendering is unavailable. Use the pin selector below.',
      );
    }
  }, [scan?.id]);
  useEffect(() => {
    if (!map.current || !scan) return;
    const m = map.current;
    const markers = scan.pins.map((p) => {
      const rank = projected ? projected.pinRanks[p.id] : p.rankFound,
        cited = projected ? projected.aiCitedPinIds[p.id] : p.targetCitedInAi;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'rounded-full border-2 border-white text-xs font-bold';
      el.style.width = el.style.height = '34px';
      el.style.backgroundColor =
        p.status !== 'COMPLETED'
          ? '#475569'
          : !rank
            ? '#334155'
            : rank <= 3
              ? '#047857'
              : rank <= 10
                ? '#92400e'
                : '#b91c1c';
      el.textContent =
        p.status === 'FAILED'
          ? '×'
          : p.status === 'PENDING'
            ? '…'
            : rank
              ? String(rank)
              : '20+';
      el.style.boxShadow = cited ? '0 0 0 4px #c084fc' : '';
      el.title =
        'Pin ' + (p.rowIdx + 1) + ',' + (p.colIdx + 1) + ' · ' + p.status;
      el.onclick = () => select(p.id);
      return new maplibregl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .addTo(m);
    });
    return () => {
      markers.forEach((v) => v.remove());
    };
  }, [scan, projected]);
  async function changeShare(action: string) {
    try {
      const r = await fetch('/api/scans/' + identifier, {
          method: 'POST',
          body: JSON.stringify({ action }),
        }),
        v = await r.json();
      if (!r.ok) throw Error(v.error);
      setShare(v.path ? window.location.origin + v.path : '');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!scan) return <p className="p-8">{error || 'Loading report…'}</p>;
  const pin = scan.pins.find((p) => p.id === selected);
  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 p-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{scan.targetBusiness}</h1>
          <p className="text-slate-300">
            {scan.keyword} · {scan.gridSize} × {scan.gridSize} ·{' '}
            {scan.targetType.replaceAll('_', ' ')}
          </p>
        </div>
        {shared ? (
          <Link
            className="rounded border border-emerald-500 p-2 text-emerald-300"
            href="/login?mode=register"
          >
            Create agency account
          </Link>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => changeShare('share')}>Share report</button>
            <button onClick={() => changeShare('revoke')}>Revoke link</button>
          </div>
        )}
      </header>
      {share && (
        <div>
          <label>
            Client report link{' '}
            <input
              className="w-full bg-slate-800 p-2"
              readOnly
              value={share}
              onFocus={(e) => e.target.select()}
            />
          </label>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <p className="text-sm">
        {scan.status} · {scan.completedPins}/{scan.totalPins} completed ·{' '}
        {scan.failedPins} failed
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ['SoLV', scan.solv, '%'],
          ['ARP', scan.arp, ''],
          ['ATRP', scan.atrp, ''],
          [
            'AI trigger',
            scan.trackAiOverviews ? scan.aioTriggerRate : null,
            '%',
          ],
          [
            'AI citation share',
            scan.trackAiOverviews ? scan.aioCitationRate : null,
            '%',
          ],
        ].map(([label, n, unit]) => (
          <div
            className="rounded-lg border border-slate-800 bg-slate-900 p-3"
            key={label}
          >
            <div className="text-xs text-slate-400">{label}</div>
            <strong className="text-2xl">
              {n == null ? '—' : String(n) + unit}
            </strong>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div>
          <p className="mb-2 text-sm text-slate-300">
            Showing {projected?.businessName ?? scan.targetBusiness} · purple
            ring = AI appearance
          </p>
          <div ref={container} className="h-[420px] rounded-lg bg-slate-900" />
          {mapWarning && <p>{mapWarning}</p>}
        </div>
        <aside className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
          <label className="block font-bold">
            Pin evidence
            <select
              value={selected ?? ''}
              onChange={(e) => select(e.target.value)}
              className="mt-2 block w-full rounded bg-slate-800 p-2 text-sm"
            >
              <option value="">Choose a coordinate</option>
              {scan.pins.map((p) => (
                <option value={p.id} key={p.id}>
                  Row {p.rowIdx + 1} · Col {p.colIdx + 1} · {p.status}
                </option>
              ))}
            </select>
          </label>
          {pin && (
            <>
              <p className="text-sm">
                {pin.lat}, {pin.lng} · {pin.city} {pin.stateCode} {pin.zip}
              </p>
              <p>
                Target rank ·{' '}
                {pin.status !== 'COMPLETED'
                  ? pin.status
                  : (pin.rankFound ?? 'Outside top 20')}
              </p>
              {pin.proxyMeta && (
                <p className="text-xs text-emerald-300">
                  Proxy exit ·{' '}
                  {[
                    pin.proxyMeta.city,
                    pin.proxyMeta.region,
                    pin.proxyMeta.country,
                  ]
                    .filter(Boolean)
                    .join(', ')}{' '}
                  · {pin.proxyMeta.rungUsed}
                </p>
              )}
              {pin.videoUrl && (
                <video
                  controls
                  preload="metadata"
                  src={pin.videoUrl}
                  className="max-h-72 w-full"
                />
              )}
              {pin.aiOverviewText && (
                <details>
                  <summary>AI text and visible sources</summary>
                  <p className="whitespace-pre-wrap text-sm">
                    {pin.aiOverviewText}
                  </p>
                  <p>{pin.aiCitations?.join(' · ')}</p>
                </details>
              )}
              {pin.topCompetitors?.length ? (
                <details>
                  <summary>Observed result order</summary>
                  <ol className="list-decimal pl-5">
                    {pin.topCompetitors.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ol>
                </details>
              ) : null}
              {!shared && (
                <div className="flex gap-3 text-emerald-300">
                  {pin.metaJsonUrl && (
                    <a href={pin.metaJsonUrl}>Receipt JSON</a>
                  )}
                  {pin.dumpsTarUrl && <a href={pin.dumpsTarUrl}>Raw bundle</a>}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
      <CompetitorLeaderboard
        pins={scan.pins}
        targetBusiness={scan.targetBusiness}
        activeProjectedBusiness={projected?.businessName}
        onSelectCompetitorForMap={project}
      />
    </div>
  );
}
