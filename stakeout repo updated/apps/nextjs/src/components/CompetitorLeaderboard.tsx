// apps/nextjs/src/components/CompetitorLeaderboard.tsx
'use client';
import React, { useMemo, useState } from 'react';
import {
  Trophy,
  Search,
  ArrowUpDown,
  Eye,
  Download,
  Sparkles,
} from 'lucide-react';
import type { GridPinData } from './GeoGridDashboard';
export interface CompetitorMarketStat {
  businessName: string;
  normalizedKey: string;
  isTarget: boolean;
  solv: number; // % of completed pins where rank is 1, 2, or 3
  arp: number; // Average rank across pins where business was found (1..20)
  atrp: number; // Average rank across ALL completed pins (unfound = 21)
  foundPinsCount: number; // Number of pins where business appeared in Top 20
  coveragePct: number; // % of completed pins where business appeared in Top 20
  top3Count: number; // Count of pins ranking 1–3
  rank4to10Count: number; // Count of pins ranking 4–10
  rank11to20Count: number; // Count of pins ranking 11–20
  unrankedCount: number; // Count of pins ranking 20+
  bestRank: number;
  // AI Overview / Ask Maps Citation Metrics
  aiCitedCount: number; // Number of pins where business/domain was cited in AI Overview / Ask Maps
  aiCitationSharePct: number; // % of all completed pins where business was cited in AI
  aiShareWhenTriggeredPct: number; // % of AI-triggered pins where business was cited
  pinRanks: Record<string, number>; // Map of pinId -> rank (1..20) for map re-projection
  aiCitedPinIds: Record<string, boolean>; // Map of pinId -> true if cited in AI on that pin
}
interface CompetitorLeaderboardProps {
  pins: GridPinData[];
  targetBusiness: string;
  activeProjectedBusiness?: string | null;
  onSelectCompetitorForMap?: (competitor: CompetitorMarketStat | null) => void;
}
type SortField =
  | 'solv'
  | 'aiCitationSharePct'
  | 'atrp'
  | 'arp'
  | 'foundPinsCount'
  | 'top3Count';
function normalizeBizName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}
export function CompetitorLeaderboard({
  pins,
  targetBusiness,
  activeProjectedBusiness,
  onSelectCompetitorForMap,
}: CompetitorLeaderboardProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('solv');
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const completedPins = useMemo(
    () => pins.filter((p) => p.status === 'COMPLETED'),
    [pins],
  );
  const totalAiTriggeredPins = useMemo(
    () => completedPins.filter((p) => p.hasAiOverview).length,
    [completedPins],
  );
  // Aggregate organic Top 20 rankings + AI Overview / Ask Maps citations across all 121 XML dumps
  const leaderboard = useMemo<CompetitorMarketStat[]>(() => {
    const totalCompleted = completedPins.length;
    if (totalCompleted === 0) return [];
    const normalizedTarget = normalizeBizName(targetBusiness);
    const map = new Map<
      string,
      {
        displayName: string;
        isTarget: boolean;
        ranksSumFound: number;
        foundCount: number;
        top3: number;
        r4to10: number;
        r11to20: number;
        bestRank: number;
        aiCitedCount: number;
        pinRanks: Record<string, number>;
        aiCitedPinIds: Record<string, boolean>;
      }
    >();
    function getOrCreateEntry(rawName: string) {
      const norm = normalizeBizName(rawName);
      let entry = map.get(norm);
      if (!entry) {
        const matchesTarget =
          norm === normalizedTarget ||
          (normalizedTarget.length > 2 &&
            (norm.includes(normalizedTarget) ||
              normalizedTarget.includes(norm)));
        entry = {
          displayName: rawName.trim(),
          isTarget: matchesTarget,
          ranksSumFound: 0,
          foundCount: 0,
          top3: 0,
          r4to10: 0,
          r11to20: 0,
          bestRank: 21,
          aiCitedCount: 0,
          pinRanks: {},
          aiCitedPinIds: {},
        };
        map.set(norm, entry);
      }
      return { norm, entry };
    }
    getOrCreateEntry(targetBusiness);
    // Pass 1: Collect Organic / Local Pack Top 20 Rankings per Pin
    for (const pin of completedPins) {
      const list = Array.isArray(pin.topCompetitors) ? pin.topCompetitors : [];
      const seenInThisPin = new Set<string>();
      list.slice(0, 20).forEach((rawName, idx) => {
        if (!rawName || typeof rawName !== 'string') return;
        const { norm, entry } = getOrCreateEntry(rawName);
        if (!norm || seenInThisPin.has(norm)) return;
        seenInThisPin.add(norm);
        const rank = idx + 1;
        entry.ranksSumFound += rank;
        entry.foundCount += 1;
        entry.pinRanks[pin.id] = rank;
        if (rank < entry.bestRank) entry.bestRank = rank;
        if (rank <= 3) entry.top3 += 1;
        else if (rank <= 10) entry.r4to10 += 1;
        else entry.r11to20 += 1;
      });
    }
    // Pass 2: Attribute AI Overview & Ask Maps Citations across all Pins
    for (const pin of completedPins) {
      if (!pin.hasAiOverview) continue;
      const citedOnThisPin = new Set<string>();
      const rawCitations = Array.isArray(pin.aiCitations)
        ? pin.aiCitations
        : [];
      const aioTextLower = String(pin.aiOverviewText ?? '').toLowerCase();
      // 2A. Match explicit AI citation pills against known businesses or create AI-cited entities
      for (const rawCite of rawCitations) {
        if (!rawCite || typeof rawCite !== 'string') continue;
        const normCite = normalizeBizName(rawCite);
        if (!normCite || normCite.length < 3) continue;
        let matchedKnownKey: string | null = null;
        for (const [knownKey] of map.entries()) {
          if (
            knownKey === normCite ||
            (knownKey.length >= 4 && normCite.includes(knownKey)) ||
            (normCite.length >= 4 && knownKey.includes(normCite))
          ) {
            matchedKnownKey = knownKey;
            break;
          }
        }
        if (matchedKnownKey) {
          citedOnThisPin.add(matchedKnownKey);
        } else {
          // Standalone domain or entity cited in AI Overview
          const { norm } = getOrCreateEntry(rawCite);
          citedOnThisPin.add(norm);
        }
      }
      // 2B. Check if any known competitor business name is mentioned inside the AI Overview body text
      if (aioTextLower.length > 0) {
        for (const [knownKey, entry] of map.entries()) {
          if (knownKey.length >= 4 && aioTextLower.includes(knownKey)) {
            citedOnThisPin.add(knownKey);
          } else if (entry.isTarget && pin.targetCitedInAi) {
            citedOnThisPin.add(knownKey);
          }
        }
      }
      // Record AI citation credit for this pin
      for (const normKey of citedOnThisPin) {
        const entry = map.get(normKey);
        if (entry && !entry.aiCitedPinIds[pin.id]) {
          entry.aiCitedCount += 1;
          entry.aiCitedPinIds[pin.id] = true;
        }
      }
    }
    // Pass 3: Compute Final Ratios
    const stats: CompetitorMarketStat[] = [];
    for (const [normKey, item] of map.entries()) {
      const unrankedCount = Math.max(0, totalCompleted - item.foundCount);
      const totalRankSumAllPins = item.ranksSumFound + unrankedCount * 21;
      const arp =
        item.foundCount > 0 ? item.ranksSumFound / item.foundCount : 21;
      const atrp = totalRankSumAllPins / totalCompleted;
      const solv = (item.top3 / totalCompleted) * 100;
      const coveragePct = (item.foundCount / totalCompleted) * 100;
      const aiCitationSharePct = (item.aiCitedCount / totalCompleted) * 100;
      const aiShareWhenTriggeredPct =
        totalAiTriggeredPins > 0
          ? (item.aiCitedCount / totalAiTriggeredPins) * 100
          : 0;
      stats.push({
        businessName: item.displayName,
        normalizedKey: normKey,
        isTarget: item.isTarget,
        solv: Number(solv.toFixed(1)),
        arp: Number(arp.toFixed(2)),
        atrp: Number(atrp.toFixed(2)),
        foundPinsCount: item.foundCount,
        coveragePct: Number(coveragePct.toFixed(1)),
        top3Count: item.top3,
        rank4to10Count: item.r4to10,
        rank11to20Count: item.r11to20,
        unrankedCount,
        bestRank: item.bestRank,
        aiCitedCount: item.aiCitedCount,
        aiCitationSharePct: Number(aiCitationSharePct.toFixed(1)),
        aiShareWhenTriggeredPct: Number(aiShareWhenTriggeredPct.toFixed(1)),
        pinRanks: item.pinRanks,
        aiCitedPinIds: item.aiCitedPinIds,
      });
    }
    return stats.sort((a, b) => {
      if (b.solv !== a.solv) return b.solv - a.solv;
      if (b.aiCitationSharePct !== a.aiCitationSharePct) {
        return b.aiCitationSharePct - a.aiCitationSharePct;
      }
      return a.atrp - b.atrp;
    });
  }, [completedPins, totalAiTriggeredPins, targetBusiness]);
  const filteredAndSorted = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    const list = q
      ? leaderboard.filter((c) => c.businessName.toLowerCase().includes(q))
      : [...leaderboard];
    list.sort((a, b) => {
      let diff = 0;
      if (sortBy === 'solv') diff = a.solv - b.solv;
      else if (sortBy === 'aiCitationSharePct')
        diff = a.aiCitationSharePct - b.aiCitationSharePct;
      else if (sortBy === 'atrp')
        diff = b.atrp - a.atrp; // Lower ATRP is better
      else if (sortBy === 'arp')
        diff = b.arp - a.arp; // Lower ARP is better
      else if (sortBy === 'foundPinsCount')
        diff = a.foundPinsCount - b.foundPinsCount;
      else if (sortBy === 'top3Count') diff = a.top3Count - b.top3Count;
      return sortDesc ? -diff : diff;
    });
    return list;
  }, [leaderboard, searchFilter, sortBy, sortDesc]);
  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDesc((prev) => !prev);
    } else {
      setSortBy(field);
      setSortDesc(true);
    }
  }
  function handleExportCsv() {
    const headers = [
      'Market Rank',
      'Business / Entity Name',
      'Is Target',
      'SoLV (%)',
      'AI Citation Share (%)',
      'AI Cited Pins',
      'AI Share When Triggered (%)',
      'ATRP',
      'ARP',
      'Top 3 Pins',
      'Rank 4-10 Pins',
      'Rank 11-20 Pins',
      'Unranked (20+) Pins',
      'Grid Presence (%)',
    ];
    const rows = filteredAndSorted.map((c, idx) => [
      idx + 1,
      `"${(/^[=+@\-\t\r]/.test(c.businessName) ? "'" : '') + c.businessName.replace(/"/g, '""')}"`,
      c.isTarget ? 'YES' : 'NO',
      c.solv,
      c.aiCitationSharePct,
      c.aiCitedCount,
      c.aiShareWhenTriggeredPct,
      c.atrp,
      c.arp,
      c.top3Count,
      c.rank4to10Count,
      c.rank11to20Count,
      c.unrankedCount,
      c.coveragePct,
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');
    const link = document.createElement('a');
    const url = URL.createObjectURL(
      new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }),
    );
    link.href = url;
    link.setAttribute('download', `stakeout_competitor_solv_ai_matrix.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (completedPins.length === 0) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60">
        Waiting for completed XML dumps to calculate market-wide Share of Local
        Voice & AI Citation Share...
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-col bg-slate-950 text-slate-100">
      {/* Top Action & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/80 px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Trophy className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              Competitor Share of Local Voice (SoLV) & AI Citation Leaderboard
            </h2>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border">
              {leaderboard.length} Entities Tracked
            </span>
            {totalAiTriggeredPins > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs">
                <Sparkles className="h-3 w-3 text-purple-400" />
                AI Triggered on {totalAiTriggeredPins}/{completedPins.length}{' '}
                Pins
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Select a business to see its ranks and AI appearances across{' '}
            {completedPins.length} completed pins.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeProjectedBusiness && onSelectCompetitorForMap && (
            <button
              type="button"
              onClick={() => onSelectCompetitorForMap(null)}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2"
            >
              Reset Map to Target Business
            </button>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Filter business or domain..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-60 rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white"
            />
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            Export CSV
          </button>
        </div>
      </div>
      {/* Leaderboard Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 text-[11px] font-semibold">
            <tr>
              <th className="py-3.5 pl-6 pr-3 w-14">#</th>
              <th className="px-3 py-3.5">Business / Cited Entity</th>
              <th className="px-3 py-3.5">
                <button
                  type="button"
                  onClick={() => handleSort('solv')}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  SoLV (Top 3) <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3.5">
                <button
                  type="button"
                  onClick={() => handleSort('aiCitationSharePct')}
                  className="inline-flex items-center gap-1 text-purple-300 hover:text-purple-200"
                >
                  <Sparkles className="h-3 w-3 text-purple-400" />
                  AI Citation Share <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3.5">
                <button
                  type="button"
                  onClick={() => handleSort('atrp')}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  ATRP <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3.5">
                <button
                  type="button"
                  onClick={() => handleSort('arp')}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  ARP <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3.5">
                <button
                  type="button"
                  onClick={() => handleSort('foundPinsCount')}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  Grid Presence <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="px-3 py-3.5 w-60">
                Pin Rank Distribution (1–20+)
              </th>
              <th className="py-3.5 pl-3 pr-6 text-right">Map Projection</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {filteredAndSorted.map((comp, idx) => {
              const total = completedPins.length;
              const pTop3 = (comp.top3Count / total) * 100;
              const p4to10 = (comp.rank4to10Count / total) * 100;
              const p11to20 = (comp.rank11to20Count / total) * 100;
              const isProjected =
                activeProjectedBusiness === comp.normalizedKey;
              return (
                <tr
                  key={comp.normalizedKey}
                  className={`transition-colors ${
                    comp.isTarget
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/15'
                      : isProjected
                        ? 'bg-sky-500/10 hover:bg-sky-500/15'
                        : 'hover:bg-slate-900/70'
                  }`}
                >
                  {/* Standing # */}
                  <td className="py-3.5 pl-6 pr-3 font-mono font-bold text-slate-300">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-950 font-extrabold'
                          : idx === 1
                            ? 'bg-slate-300 text-slate-950 font-bold'
                            : idx === 2
                              ? 'bg-amber-700 text-white font-bold'
                              : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                  </td>
                  {/* Business Name + Badges */}
                  <td className="px-3 py-3.5 font-medium text-white">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate max-w-[240px]">
                        {comp.businessName}
                      </span>
                      {comp.isTarget && (
                        <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-extrabold uppercase">
                          Your Target
                        </span>
                      )}
                      {comp.foundPinsCount === 0 && comp.aiCitedCount > 0 && (
                        <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-semibold">
                          AI-Only Source
                        </span>
                      )}
                      {isProjected && !comp.isTarget && (
                        <span className="rounded bg-sky-400 px-1.5 py-0.5 text-[10px] font-extrabold uppercase">
                          Projected on Map
                        </span>
                      )}
                    </div>
                  </td>
                  {/* SoLV % */}
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-extrabold ${
                          comp.solv >= 50
                            ? 'text-emerald-400'
                            : comp.solv >= 20
                              ? 'text-amber-400'
                              : 'text-slate-300'
                        }`}
                      >
                        {comp.solv.toFixed(1)}%
                      </span>
                      <span className="text-[11px] text-slate-500">
                        ({comp.top3Count} pins)
                      </span>
                    </div>
                  </td>
                  {/* NEW: AI Overview / Ask Maps Citation Share (%) */}
                  <td className="px-3 py-3.5">
                    {comp.aiCitedCount > 0 ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-sm font-extrabold text-purple-300">
                            <Sparkles className="h-3 w-3 text-purple-400" />
                            {comp.aiCitationSharePct.toFixed(1)}%
                          </span>
                          <span className="text-[11px] text-slate-400">
                            ({comp.aiCitedCount}/{total} pins)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full bg-purple-500"
                              style={{
                                width: `${Math.min(100, comp.aiCitationSharePct)}%`,
                              }}
                            />
                          </div>
                          {totalAiTriggeredPins > 0 && (
                            <span className="text-[10px] font-mono text-purple-300/80">
                              {comp.aiShareWhenTriggeredPct.toFixed(0)}% of AI
                              SERPs
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        0.0% (0 pins)
                      </span>
                    )}
                  </td>
                  {/* ATRP */}
                  <td className="px-3 py-3.5 font-mono font-semibold text-slate-200">
                    {comp.atrp.toFixed(2)}
                  </td>
                  {/* ARP */}
                  <td className="px-3 py-3.5 font-mono text-slate-300">
                    {comp.foundPinsCount > 0 ? comp.arp.toFixed(2) : '—'}
                  </td>
                  {/* Grid Presence */}
                  <td className="px-3 py-3.5">
                    <div className="text-slate-200 font-medium">
                      {comp.foundPinsCount}/{total} pins ({comp.coveragePct}%)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {comp.foundPinsCount > 0
                        ? `Best Rank: #${comp.bestRank}`
                        : 'Not in Local Pack'}
                    </div>
                  </td>
                  {/* Visual Stacked Bar: Green (1-3), Yellow (4-10), Red (11-20), Grey (20+) */}
                  <td className="px-3 py-3.5">
                    <div className="space-y-1">
                      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          style={{ width: `${pTop3}%` }}
                          className="bg-emerald-500"
                          title={`Top 3: ${comp.top3Count} pins`}
                        />
                        <div
                          style={{ width: `${p4to10}%` }}
                          className="bg-amber-500"
                          title={`Rank 4–10: ${comp.rank4to10Count} pins`}
                        />
                        <div
                          style={{ width: `${p11to20}%` }}
                          className="bg-red-500"
                          title={`Rank 11–20: ${comp.rank11to20Count} pins`}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span className="text-emerald-400">
                          1-3: {comp.top3Count}
                        </span>
                        <span className="text-amber-400">
                          4-10: {comp.rank4to10Count}
                        </span>
                        <span className="text-red-400">
                          11-20: {comp.rank11to20Count}
                        </span>
                        <span className="text-slate-500">
                          20+: {comp.unrankedCount}
                        </span>
                      </div>
                    </div>
                  </td>
                  {/* Action: Project Competitor's Ranks & AI Citations onto MapLibre Grid */}
                  <td className="py-3.5 pl-3 pr-6 text-right">
                    {onSelectCompetitorForMap && (
                      <button
                        type="button"
                        onClick={() =>
                          onSelectCompetitorForMap(isProjected ? null : comp)
                        }
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                          isProjected
                            ? 'border-sky-400 bg-sky-500/20 text-sky-300'
                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-500/50 hover:text-white'
                        }`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {isProjected ? 'Viewing Grid' : 'View Grid'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
