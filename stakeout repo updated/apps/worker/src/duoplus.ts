import { randomUUID } from 'node:crypto';
import { db } from '@stakeout/db';
import { redis } from '@stakeout/core/redis';
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
export async function acquireDeviceLease(pinId: string, phoneModel: string) {
  const model = modelCodes[phoneModel] ?? phoneModel;
  const available = await db.devicePool.findMany({
    where: {
      isEnabled: true,
      bootstrappedAt: { not: null },
      hardwareModel: { in: [model, phoneModel], mode: 'insensitive' },
    },
  });
  if (!available.length) throw new Error('NO_BOOTSTRAPPED_MATCHING_PHONE');
  const store = redis();
  for (const d of available) {
    if (d.cooldownUntil > new Date()) continue;
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
