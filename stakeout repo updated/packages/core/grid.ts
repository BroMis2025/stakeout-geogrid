import { createHash } from 'node:crypto';
import zipcodes from 'zipcodes';

export class InputError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const phoneModels: Record<string, string[]> = {
  Samsung: ['Galaxy S23 Ultra', 'Galaxy S24+', 'Galaxy Z Fold5'],
  Google: ['Pixel 8 Pro', 'Pixel 7', 'Pixel 8a'],
  Motorola: ['Moto Edge 40', 'Moto G Stylus 5G'],
  Xiaomi: ['Xiaomi 13 Pro', 'Redmi Note 12'],
};
export function parseSpec(input: Record<string, unknown>) {
  const { keyword, targetBusiness, centerLat, centerLng } = input;
  if (
    typeof keyword !== 'string' ||
    !keyword.trim() ||
    keyword.length > 200 ||
    typeof targetBusiness !== 'string' ||
    !targetBusiness.trim() ||
    targetBusiness.length > 200
  ) {
    throw new InputError(
      'Enter a business name and query of 1–200 characters.',
    );
  }
  if (
    typeof centerLat !== 'number' ||
    !Number.isFinite(centerLat) ||
    Math.abs(centerLat) >= 85 ||
    typeof centerLng !== 'number' ||
    !Number.isFinite(centerLng) ||
    Math.abs(centerLng) > 180
  ) {
    throw new InputError('Enter valid US coordinates.');
  }
  const { gridSize = 7, spacingKm = 1.60934, trackAiOverviews = false } = input;
  if (
    typeof gridSize !== 'number' ||
    ![3, 5, 7, 9, 11].includes(gridSize) ||
    typeof spacingKm !== 'number' ||
    ![0.80467, 1.60934, 3.21868, 8.04672].includes(spacingKm) ||
    typeof trackAiOverviews !== 'boolean'
  )
    throw new InputError('Invalid grid size, spacing or AI option.');
  const targetType = String(input.targetType ?? 'mobile_maps');
  const scheduleType = String(input.scheduleType ?? 'once');
  const phoneBrand = String(input.phoneBrand ?? 'Samsung');
  const phoneModel = String(input.phoneModel ?? 'Galaxy S23 Ultra');
  const ispId = String(input.ispId ?? 'ANY');
  if (
    ![
      'mobile_maps',
      'mobile_chrome',
      'mobile_google',
      ...(process.env.DESKTOP_ENABLED === 'true' ? ['desktop_aimode'] : []),
    ].includes(targetType)
  )
    throw new InputError('Choose a supported Android surface.');
  if (
    !['once', 'daily', 'weekly'].includes(scheduleType) ||
    !phoneModels[phoneBrand]?.includes(phoneModel) ||
    !/^[\w &.-]{1,65}$/.test(ispId)
  )
    throw new InputError('Invalid schedule, phone profile, or ISP.');
  return {
    keyword: keyword.trim(),
    targetBusiness: targetBusiness.trim(),
    centerLat,
    centerLng,
    gridSize,
    spacingKm,
    trackAiOverviews: targetType === 'desktop_aimode' || trackAiOverviews,
    targetType,
    scheduleType,
    phoneBrand,
    phoneModel,
    ispId,
  };
}
export type ScanSpec = ReturnType<typeof parseSpec>;
export function market(lat: number, lng: number) {
  const z = zipcodes.lookupByCoords(lat, lng);
  if (!z || z.country !== 'US')
    throw new InputError('Choose a location near a US postal area.');
  const km = Math.hypot(
    (lat - z.latitude) * 111.2,
    (lng - z.longitude) * 111.2 * Math.cos((lat * Math.PI) / 180),
  );
  if (km > 120)
    throw new InputError('Location is too far from a mapped US ZIP centroid.');
  return { zip: z.zip, city: z.city, stateCode: z.state };
}
export function buildGrid(s: ScanSpec) {
  const half = (s.gridSize - 1) / 2,
    dy = ((s.spacingKm / 6371) * 180) / Math.PI,
    dx = dy / Math.cos((s.centerLat * Math.PI) / 180);
  return Array.from({ length: s.gridSize ** 2 }, (_, i) => {
    const rowIdx = Math.floor(i / s.gridSize),
      colIdx = i % s.gridSize;
    const lat = +(s.centerLat - (rowIdx - half) * dy).toFixed(6),
      lng = +(s.centerLng + (colIdx - half) * dx).toFixed(6);
    return { rowIdx, colIdx, lat, lng, ...market(lat, lng) };
  });
}
export function campaignId(userId: string, s: ScanSpec) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        userId,
        s.keyword.toLowerCase(),
        s.targetBusiness.toLowerCase(),
        s.centerLat,
        s.centerLng,
        s.gridSize,
        s.spacingKm,
        s.targetType,
        s.phoneBrand,
        s.phoneModel,
        s.ispId,
        s.trackAiOverviews,
      ]),
    )
    .digest('hex');
}
export function scheduleCron(kind: string) {
  return kind === 'daily'
    ? '0 13 * * *'
    : kind === 'weekly'
      ? '0 13 * * 1'
      : null;
}
export function metrics(
  pins: {
    rankFound: number | null;
    hasAiOverview: boolean;
    targetCitedInAi: boolean;
  }[],
) {
  if (!pins.length)
    return {
      arp: null,
      atrp: null,
      solv: null,
      aioTriggerRate: null,
      aioCitationRate: null,
    };
  const ranks = pins.flatMap((p) =>
    p.rankFound && p.rankFound <= 20 ? [p.rankFound] : [],
  );
  const sum = ranks.reduce((a, b) => a + b, 0),
    pct = (n: number) => +((100 * n) / pins.length).toFixed(2);
  return {
    arp: ranks.length ? +(sum / ranks.length).toFixed(2) : 21,
    atrp: +((sum + 21 * (pins.length - ranks.length)) / pins.length).toFixed(2),
    solv: pct(ranks.filter((r) => r <= 3).length),
    aioTriggerRate: pct(pins.filter((p) => p.hasAiOverview).length),
    aioCitationRate: pct(pins.filter((p) => p.targetCitedInAi).length),
  };
}
