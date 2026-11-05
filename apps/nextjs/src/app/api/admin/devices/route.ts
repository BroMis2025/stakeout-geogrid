import { getAuthenticatedUser } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { db } from '@stakeout/db';
import { InputError } from '@stakeout/core/grid';
import { redis, duoplusPost } from '@stakeout/core/redis';
import { RUN_PIN_SH_V2 } from '@stakeout/core/runner';
export const maxDuration = 120;
async function admin() {
  if ((await getAuthenticatedUser()).role !== 'ADMIN')
    throw new InputError('Administrator access required.', 403);
}
export async function GET() {
  try {
    await admin();
    const devices = await db.devicePool.findMany({
      orderBy: { slotIndex: 'asc' },
    });
    return Response.json({
      devices: await Promise.all(
        devices.map(async (d) => {
          const key = 'lock:duoplus:' + d.imageId,
            [value, ttl] = await Promise.all([
              redis().get(key),
              redis().ttl(key),
            ]);
          const cooldown = Math.max(
            0,
            Math.ceil((+d.cooldownUntil - Date.now()) / 1000),
          );
          return {
            ...d,
            activePinId: value?.split('|')[0],
            lockTtlSec: ttl,
            cooldownRemainingSec: cooldown,
            proxyPort:
              process.env.PROXY_USE_SLOT_PORT === 'true'
                ? 10000 + d.slotIndex
                : Number(process.env.PROXY_PORT ?? 10000),
            runtimeState: !d.isEnabled
              ? 'DISABLED'
              : value
                ? 'BUSY'
                : cooldown
                  ? 'COOLDOWN'
                  : 'IDLE',
          };
        }),
      ),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
async function bootstrap(ids: string[]) {
  const b64 = Buffer.from(RUN_PIN_SH_V2).toString('base64');
  const cmd = [
    'mkdir -p /data/local/tmp/rt',
    'settings put global window_animation_scale 0',
    'settings put global transition_animation_scale 0',
    'settings put global animator_duration_scale 0',
    "echo 'chrome --disable-fre --no-first-run' > /data/local/tmp/chrome-command-line",
    'echo ' + b64 + ' | base64 -d > /data/local/tmp/rt/run_pin.next',
    'chmod 755 /data/local/tmp/rt/run_pin.next',
    'mv /data/local/tmp/rt/run_pin.next /data/local/tmp/rt/run_pin.sh',
    'getprop ro.product.brand',
    'getprop ro.product.model',
  ].join(' && ');
  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20);
    const res = await duoplusPost('/api/v1/cloudPhone/command', {
      image_ids: batch,
      command: cmd,
    });
    for (const id of batch) {
      const item = res.data[id],
        values = String(item?.content ?? '')
          .trim()
          .split(/\r?\n/);
      if (item?.success !== true || values.length < 2)
        throw new InputError('Bootstrap failed for ' + id, 502);
      await db.devicePool.update({
        where: { imageId: id },
        data: {
          hardwareBrand: values.at(-2),
          hardwareModel: values.at(-1),
          bootstrappedAt: new Date(),
        },
      });
    }
  }
}
export async function POST(req: Request) {
  try {
    await admin();
    const { action, devices, imageId, isEnabled } = await req.json();
    if (action === 'ADD_DEVICES') {
      if (
        !Array.isArray(devices) ||
        !devices.length ||
        devices.length > 200 ||
        !devices.every((d) =>
          [d?.imageId, d?.proxyId].every(
            (v) => typeof v === 'string' && /^[\w.-]{1,100}$/.test(v),
          ),
        )
      )
        throw new InputError('Provide 1–200 valid phone and proxy ID pairs.');
      await db.$transaction(
        devices.map((d) =>
          db.devicePool.upsert({
            where: { imageId: d.imageId },
            create: {
              imageId: d.imageId,
              proxyId: d.proxyId,
              adbAddr: d.adbAddr ?? null,
            },
            update: { proxyId: d.proxyId, adbAddr: d.adbAddr ?? undefined },
          }),
        ),
      );
    } else if (action === 'RESET_ALL_COOLDOWNS') {
      await db.devicePool.updateMany({ data: { cooldownUntil: new Date(0) } });
    } else if (action === 'BOOTSTRAP_ALL') {
      const fleet = await db.devicePool.findMany({
        where: { isEnabled: true },
      });
      await bootstrap(fleet.map((d) => d.imageId));
    } else {
      const d =
        typeof imageId === 'string'
          ? await db.devicePool.findUnique({ where: { imageId } })
          : null;
      if (!d) throw new InputError('Unknown device.', 404);
      if (action === 'BOOTSTRAP_ONE') await bootstrap([imageId]);
      else if (action === 'RESET_COOLDOWN')
        await db.devicePool.update({
          where: { imageId },
          data: { cooldownUntil: new Date(0) },
        });
      else if (action === 'TOGGLE_ENABLED' && typeof isEnabled === 'boolean')
        await db.devicePool.update({ where: { imageId }, data: { isEnabled } });
      else if (action === 'DELETE_DEVICE') {
        if (d.isEnabled || (await redis().exists('lock:duoplus:' + imageId)))
          throw new InputError(
            'Disable the phone and wait for its lease to finish before deleting.',
            409,
          );
        await db.devicePool.delete({ where: { imageId } });
      } else throw new InputError('Unknown fleet operation.');
    }
    return Response.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
