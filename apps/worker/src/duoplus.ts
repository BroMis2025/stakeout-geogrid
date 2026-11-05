import { randomUUID } from 'node:crypto';
import { db } from '@stakeout/db';
import { redis, duoplusPost } from '@stakeout/core/redis';
export { duoplusPost } from '@stakeout/core/redis';

export const modelCodes: Record<string, string> = {
  'Galaxy S23 Ultra': 'SM-S918U',
  'Galaxy S24+': 'SM-S926U',
  'Galaxy Z Fold5': 'SM-F946U',
  'Pixel 8 Pro': 'Pixel 8 Pro',
  'Pixel 7': 'Pixel 7',
  'Pixel 8a': 'Pixel 8a',
  'Moto Edge 40': 'XT2303-2',
  'Moto G Stylus 5G': 'XT2315-1',
  'Xiaomi 13 Pro': '2210132G',
  'Redmi Note 12': '23021RAA2Y',
};

interface DuoPlusCloudPhoneItem {
  id: string;
  name?: string;
  status?: number;
  os?: string;
  ip?: string;
  area?: string;
  remark?: string;
  adb_status?: number;
  adb?: string;
  proxy_id?: string;
}

let lastAutoSyncAt = 0;

function resolveHardware(
  name = '',
  remark = '',
  fallbackModel = 'Galaxy S23 Ultra',
): { brand: string; model: string } {
  const lower = `${name} ${remark}`.trim().toLowerCase();
  if (lower.includes('pixel 8')) return { brand: 'Google', model: 'Pixel 8 Pro' };
  if (lower.includes('pixel')) return { brand: 'Google', model: 'Pixel 7' };

  for (const [label, code] of Object.entries(modelCodes)) {
    if (lower.includes(label.toLowerCase()) || lower.includes(code.toLowerCase())) {
      const brand = label.startsWith('Galaxy')
        ? 'Samsung'
        : label.startsWith('Pixel')
          ? 'Google'
          : 'Android';
      return { brand, model: code };
    }
  }

  return {
    brand: 'Samsung',
    model: modelCodes[fallbackModel] ?? fallbackModel,
  };
}

export async function syncDuoPlusDevicePool(
  fallbackPhoneModel = 'Galaxy S23 Ultra',
) {
  if (!process.env.DUOPLUS_API_KEY) return [];

  try {
    const res = await duoplusPost('/api/v1/cloudPhone/list', {
      page: 1,
      pagesize: 100,
      sort_by: 'created_at',
      order: 'desc',
    });

    const list: DuoPlusCloudPhoneItem[] = res?.data?.list ?? [];
    const usable = list
      .filter((item) => item?.id && [1, 2].includes(Number(item.status)))
      .sort((a, b) => Number(a.status) - Number(b.status));

    if (!usable.length) return [];

    const proxyRes = await duoplusPost('/api/v1/proxy/list', {
      page: 1,
      pagesize: 100,
    }).catch(() => null);
    const proxies: string[] = (proxyRes?.data?.list ?? []).map((px: any) =>
      String(px.id),
    );

    const existingPool = await db.devicePool.findMany();
    const usedProxyIds = new Set(existingPool.map((d) => d.proxyId));
    let maxSlot = existingPool.reduce(
      (max, d) => Math.max(max, d.slotIndex ?? 0),
      0,
    );

    const now = new Date();
    const synced = [];

    for (let i = 0; i < usable.length; i++) {
      const item = usable[i];
      const imageId = String(item.id);
      const hw = resolveHardware(item.name, item.remark, fallbackPhoneModel);
      const adbAddr = item.adb ? String(item.adb) : null;
      const currentRecord = existingPool.find((d) => d.imageId === imageId);

      let candidateProxy = item.proxy_id
        ? String(item.proxy_id)
        : proxies[i] || `proxy-${imageId}`;
      if (
        usedProxyIds.has(candidateProxy) &&
        currentRecord?.proxyId !== candidateProxy
      ) {
        const freeProxy = proxies.find((id) => !usedProxyIds.has(id));
        candidateProxy = freeProxy || `proxy-${imageId}`;
      }
      usedProxyIds.add(candidateProxy);

      const record = await db.devicePool.upsert({
        where: { imageId },
        update: {
          proxyId: currentRecord?.proxyId || candidateProxy,
          hardwareBrand: hw.brand,
          hardwareModel: currentRecord?.hardwareModel || hw.model,
          adbAddr,
          isEnabled: true,
          bootstrappedAt: currentRecord?.bootstrappedAt ?? now,
        },
        create: {
          imageId,
          proxyId: candidateProxy,
          slotIndex: ++maxSlot,
          hardwareBrand: hw.brand,
          hardwareModel: hw.model,
          adbAddr,
          isEnabled: true,
          bootstrappedAt: now,
          cooldownUntil: new Date(0),
        },
      });
      synced.push(record);
    }

    return synced;
  } catch (err) {
    console.error('[duoplus] Auto-sync failed:', {
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export async function acquireDeviceLease(pinId: string, phoneModel: string) {
  const model = modelCodes[phoneModel] ?? phoneModel;

  const findMatchingDevices = () =>
    db.devicePool.findMany({
      where: {
        isEnabled: true,
        bootstrappedAt: { not: null },
        hardwareModel: { in: [model, phoneModel], mode: 'insensitive' },
      },
      orderBy: { slotIndex: 'asc' },
    });

  let available = await findMatchingDevices();

  if (!available.length && Date.now() - lastAutoSyncAt > 60000) {
    lastAutoSyncAt = Date.now();
    await syncDuoPlusDevicePool(phoneModel);
    available = await findMatchingDevices();
  }

  if (!available.length) return null;

  const store = redis();
  const now = new Date();

  // Prioritize devices that already have a live adbAddr first
  const sorted = [...available].sort(
    (a, b) => (b.adbAddr ? 1 : 0) - (a.adbAddr ? 1 : 0),
  );

  for (const d of sorted) {
    if (d.cooldownUntil && d.cooldownUntil > now) continue;
    const key = 'lock:duoplus:' + d.imageId,
      token = pinId + '|' + randomUUID();
    if (!(await store.set(key, token, 'PX', 180000, 'NX'))) continue;

    let healthy = true;
    const timer = setInterval(async () => {
      try {
        healthy = !!(await store.eval(
          "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('pexpire',KEYS[1],180000) end return 0",
          1,
          key,
          token,
        ));
      } catch {
        healthy = false;
      }
    }, 30000);

    return {
      ...d,
      assertOwned: async () => {
        if (!healthy || (await store.get(key)) !== token)
          throw new Error('DEVICE_LEASE_LOST');
      },
      release: async () => {
        clearInterval(timer);
        await store.eval(
          "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) end return 0",
          1,
          key,
          token,
        );
      },
    };
  }
  return null;
}

export type LeasedDevice = NonNullable<
  Awaited<ReturnType<typeof acquireDeviceLease>>
>;
