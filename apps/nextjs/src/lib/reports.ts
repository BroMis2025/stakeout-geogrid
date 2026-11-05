import { db, Prisma } from '@stakeout/db';
import { InputError } from '@stakeout/core/grid';
export const pinSelect = {
  id: true,
  rowIdx: true,
  colIdx: true,
  lat: true,
  lng: true,
  zip: true,
  city: true,
  stateCode: true,
  status: true,
  rankFound: true,
  topCompetitors: true,
  hasAiOverview: true,
  targetCitedInAi: true,
  aiOverviewText: true,
  aiCitations: true,
  videoUrl: true,
  proxyMeta: true,
  metaJsonUrl: true,
  dumpsTarUrl: true,
} as const;
export const reportSelect = {
  id: true,
  keyword: true,
  targetBusiness: true,
  centerLat: true,
  centerLng: true,
  gridSize: true,
  spacingKm: true,
  targetType: true,
  phoneBrand: true,
  phoneModel: true,
  trackAiOverviews: true,
  totalPins: true,
  completedPins: true,
  failedPins: true,
  createdAt: true,
  status: true,
  solv: true,
  atrp: true,
  arp: true,
  aioTriggerRate: true,
  aioCitationRate: true,
  pins: { select: pinSelect, orderBy: [{ rowIdx: 'asc' }, { colIdx: 'asc' }] },
} satisfies Prisma.GridScanSelect;
export async function report(where: Prisma.GridScanWhereInput) {
  const s = await db.gridScan.findFirst({ where, select: reportSelect });
  if (!s) throw new InputError('Report unavailable.', 404);
  return {
    ...s,
    pins: s.pins.map((p) => {
      const m = p.proxyMeta as Record<string, unknown> | null;
      const token =
        typeof where.shareToken === 'string' ? where.shareToken : null;
      const route = '/api/proof/' + p.id + '?kind=';
      return {
        ...p,
        videoUrl: p.videoUrl
          ? route + 'video' + (token ? '&share=' + token : '')
          : null,
        metaJsonUrl: !token && p.metaJsonUrl ? route + 'meta' : null,
        dumpsTarUrl: !token && p.dumpsTarUrl ? route + 'bundle' : null,
        proxyMeta: m
          ? {
              city: m.city,
              region: m.region,
              rungUsed: m.rungUsed,
              country: m.country,
            }
          : null,
      };
    }),
  };
}
