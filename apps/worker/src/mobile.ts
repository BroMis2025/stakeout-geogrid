import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { x as unpack } from 'tar';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { db, type GridPin, type GridScan } from '@stakeout/db';
import { r2, bucket, put, uploadURL, uploaded } from '@stakeout/core/r2';
import { duoplusPost, type LeasedDevice } from './duoplus';
import { parsePinXmlBundle } from './xmlParser';
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
import { shellQuote } from '@stakeout/core/runner';
type Pin = GridPin & { scan: GridScan };
function idMap(key: string) {
  return JSON.parse(process.env[key] ?? '{}') as Record<string, string>;
}
export async function provision(device: LeasedDevice, p: Pin) {
  const base = process.env.PROXY_SELLER_BASE_LOGIN!,
    password = process.env.PROXY_SELLER_PASSWORD!;
  const isp = /^\d+$/.test(p.scan.ispId)
    ? p.scan.ispId
    : idMap('PROXY_ISP_IDS_JSON')[p.scan.ispId];
  const suffix = isp && /^\d+$/.test(isp) ? '_isp_' + isp : '';
  const city = p.city.trim().replace(/\s+/g, '-'),
    sd = idMap('PROXY_STATE_IDS_JSON')[p.stateCode];
  const choices = [
    ['ZIP' + (suffix ? '+ISP' : ''), '_zip_' + p.zip + suffix],
    ['CITY' + (suffix ? '+ISP' : ''), '_city_' + city + suffix],
  ];
  if (suffix) choices.push(['CITY', '_city_' + city]);
  if (sd && /^\d+$/.test(sd)) choices.push(['STATE', '_sd_' + sd]);
  for (const [rungUsed, target] of choices)
    for (let i = 0; i < 3; i++) {
      await device.assertOwned();
      const port =
        process.env.PROXY_USE_SLOT_PORT === 'true'
          ? 10000 + device.slotIndex
          : Number(process.env.PROXY_PORT ?? 10000);
      const user =
        base +
        '_c_US' +
        target +
        '_s_' +
        randomBytes(6).toString('hex') +
        '_ttl_10m';
      await duoplusPost('/api/v1/proxy/update', {
        id: device.proxyId,
        host: process.env.PROXY_SELLER_HOST ?? 'us.res.proxy-seller.com',
        port,
        user,
        password,
        protocol: 'socks5',
        ip_scan_channel: 'ip2location',
      });
      const { data } = await duoplusPost('/api/v1/proxy/check', {
        proxy_id: device.proxyId,
        ip_scan_channel: 'ip2location',
      });
      if (
        data?.success &&
        data.ip &&
        /^(us|united states)$/i.test(data.country)
      )
        return {
          ip: String(data.ip),
          city: String(data.city ?? ''),
          region: String(data.region ?? ''),
          country: String(data.country),
          timezone: String(data.timezone ?? ''),
          rungUsed,
          ispRequested: p.scan.ispId,
          ispRuleApplied: !!suffix && rungUsed.includes('ISP'),
          port,
        };
    }
  throw new Error('PROXY_LADDER_EXHAUSTED');
}
export async function readBundle(key: string, tag: string, dir: string) {
  const obj = await r2().send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!obj.ContentLength || obj.ContentLength > 64 * 1024 ** 2)
    throw new Error('INVALID_BUNDLE_SIZE');
  await writeFile(join(dir, 'raw.tgz'), await obj.Body!.transformToByteArray());
  let bytes = 0,
    files = 0;
  await unpack({
    file: join(dir, 'raw.tgz'),
    cwd: dir,
    strict: true,
    filter: (name, entry) => {
      if (!('type' in entry)) return false;
      if (name === tag || name === tag + '/') return entry.type === 'Directory';
      if (!name.startsWith(tag + '/') || entry.type !== 'File') return false;
      const leaf = name.slice(tag.length + 1);
      if (
        !/^(video\.mp4|dump_[0-7]\.xml|aio_(initial|expanded)\.xml|flags\.txt|meta\.txt)$/.test(
          leaf,
        )
      )
        return false;
      const allowed = leaf === 'video.mp4' ? 40 * 1024 ** 2 : 4000000;
      bytes += entry.size;
      files++;
      return entry.size <= allowed && bytes <= 64 * 1024 ** 2 && files <= 16;
    },
  });
  const folder = join(dir, tag),
    entries = await readdir(folder);
  const xml = async (pattern: RegExp) =>
    Promise.all(
      entries
        .filter((f) => pattern.test(f))
        .sort()
        .map((f) => readFile(join(folder, f), 'utf8')),
    );
  return {
    scroll: await xml(/^dump_\d+\.xml$/),
    ai: await xml(/^aio_.*\.xml$/),
    flags: await readFile(join(folder, 'flags.txt'), 'utf8'),
    video: await readFile(join(folder, 'video.mp4')),
  };
}
export async function measureMobile(p: Pin, d: LeasedDevice) {
  const scan = p.scan,
    tagBase = randomBytes(6).toString('hex'),
    point = p.rowIdx + '_' + p.colIdx,
    tag = tagBase + '_' + point;
  const prefix = 'scans/' + p.scanId + '/pin_' + point + '/' + tagBase,
    tarKey = prefix + '/raw.tar.gz';
  const app: Record<string, string> = {
    mobile_maps: 'maps',
    mobile_google: 'google',
    mobile_chrome: 'chrome',
  };
  if (!app[scan.targetType]) throw new Error('UNSUPPORTED_SURFACE');
  const proof = await provision(d, p);
  await d.assertOwned();
  await duoplusPost('/api/v1/cloudPhone/update', {
    images: [
      {
        image_id: d.imageId,
        proxy: { id: d.proxyId, dns: 1 },
        gps: { type: 2, latitude: String(p.lat), longitude: String(p.lng) },
        locale: {
          type: 2,
          ...(proof.timezone ? { timezone: proof.timezone } : {}),
          language: 'en-US',
        },
      },
    ],
  });
  await sleep(7000);
  await d.assertOwned();
  const args = [
    app[scan.targetType],
    String(p.lat),
    String(p.lng),
    scan.keyword,
    encodeURIComponent(scan.keyword),
    tagBase,
    point,
    scan.trackAiOverviews ? '1' : '0',
  ].map(shellQuote);
  const detachedUpload = process.env.UNBIND_PROXY_BEFORE_UPLOAD === 'true';
  const putUrl = await uploadURL(tarKey);
  const command =
    'UPLOAD_URL=' +
    shellQuote(detachedUpload ? '' : putUrl) +
    ' nohup sh /data/local/tmp/rt/run_pin.sh ' +
    args.join(' ') +
    ' >/dev/null 2>&1 </dev/null &';
  await duoplusPost('/api/v1/cloudPhone/command', {
    image_ids: [d.imageId],
    command,
  });
  const deadline = Date.now() + 240000;
  await sleep(40000);
  async function waitForUpload() {
    while (!(await uploaded(tarKey))) {
      if (Date.now() >= deadline) throw new Error('R2_UPLOAD_TIMEOUT');
      await sleep(3500);
      await d.assertOwned();
    }
  }
  if (detachedUpload) {
    const folder = '/data/local/tmp/rt/' + tag;
    let ready = false;
    while (Date.now() < deadline) {
      await d.assertOwned();
      const status = await duoplusPost('/api/v1/cloudPhone/command', {
        image_id: d.imageId,
        command:
          'cat ' + shellQuote(folder + '/status') + ' 2>/dev/null || true',
      });
      if (String(status.data?.content).trim() === 'done') {
        ready = true;
        break;
      }
      await sleep(5000);
    }
    if (!ready) throw new Error('DEVICE_BUNDLE_TIMEOUT');
    try {
      await duoplusPost('/api/v1/cloudPhone/update', {
        images: [{ image_id: d.imageId, proxy: { id: '', dns: 2 } }],
      });
      await sleep(2000);
      const file = shellQuote(folder + '.tar.gz');
      const send =
        'curl --max-time 90 -fsS -H ' +
        shellQuote('Content-Type: application/gzip') +
        ' -T ' +
        file +
        ' ' +
        shellQuote(putUrl) +
        ' && rm -f ' +
        file +
        ' && rm -rf ' +
        shellQuote(folder);
      await duoplusPost('/api/v1/cloudPhone/command', {
        image_id: d.imageId,
        command:
          'nohup sh -c ' + shellQuote(send) + ' >/dev/null 2>&1 </dev/null &',
      });
      await waitForUpload();
    } finally {
      await d.assertOwned();
      await duoplusPost('/api/v1/cloudPhone/update', {
        images: [{ image_id: d.imageId, proxy: { id: d.proxyId, dns: 1 } }],
      });
    }
  } else {
    await waitForUpload();
  }
  const dir = await mkdtemp(join(tmpdir(), 'stakeout-pin-'));
  try {
    const b = await readBundle(tarKey, tag, dir);
    if (
      /unusual traffic|not a robot|verify you are human/i.test(
        b.scroll.join(' '),
      )
    )
      throw new Error('FLAG_CAPTCHA_DETECTED');
    if (b.flags.trim()) throw new Error('FLAG_MAP_DRIFT_OR_CHALLENGE');
    if (!b.video.length) throw new Error('EMPTY_VIDEO');
    const result = parsePinXmlBundle(
      b.scroll,
      scan.trackAiOverviews ? b.ai : [],
      scan.targetBusiness,
    );
    const videoUrl = prefix + '/video.mp4',
      metaJsonUrl = prefix + '/meta.json';
    await put(videoUrl, b.video, 'video/mp4');
    await put(
      metaJsonUrl,
      JSON.stringify({
        timestamp: new Date(),
        pinId: p.id,
        keyword: scan.keyword,
        targetBusiness: scan.targetBusiness,
        lat: p.lat,
        lng: p.lng,
        zip: p.zip,
        city: p.city,
        requestedHardware: scan.phoneModel,
        observedModel: d.hardwareModel,
        proxyCheck: proof,
        videoKey: videoUrl,
        rawKey: tarKey,
        ...result,
      }),
      'application/json',
    );
    return {
      assignedDeviceId: d.imageId,
      rankFound: result.targetRank,
      matchedDumpIdx: result.matchedDumpIndex,
      topCompetitors: result.orderedBusinesses,
      aiCitations: result.aiCitations,
      hasAiOverview: result.hasAiOverview,
      aiOverviewText: result.aiOverviewText,
      targetCitedInAi: result.targetCitedInAi,
      proxyMeta: proof,
      videoUrl,
      dumpsTarUrl: tarKey,
      metaJsonUrl,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
