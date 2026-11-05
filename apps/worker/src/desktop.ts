import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { put } from '@stakeout/core/r2';
import type { GridPin, GridScan } from '@stakeout/db';
const run = promisify(execFile);
export async function measureDesktop(p: GridPin & { scan: GridScan }) {
  if (process.env.DESKTOP_ENABLED !== 'true')
    throw new Error('DESKTOP_WORKER_DISABLED');
  const dir = await mkdtemp(join(tmpdir(), 'stakeout-desktop-'));
  try {
    await writeFile(
      join(dir, 'request.json'),
      JSON.stringify({ lat: p.lat, lng: p.lng, keyword: p.scan.keyword }),
    );
    try {
      await run(
        process.env.DESKTOP_PYTHON || 'python3',
        [fileURLToPath(new URL('../desktop/capture.py', import.meta.url)), dir],
        { timeout: 150000, maxBuffer: 100000 },
      );
    } catch {
      throw new Error('DESKTOP_CAPTURE_FAILED');
    }
    const r: {
      orderedBusinesses: string[];
      aiOverviewText: string;
      aiCitations: string[];
    } = JSON.parse(await readFile(join(dir, 'result.json'), 'utf8'));
    const prefix =
        'scans/' +
        p.scanId +
        '/pin_' +
        p.rowIdx +
        '_' +
        p.colIdx +
        '/' +
        randomUUID(),
      videoUrl = prefix + '/video.webm',
      dumpsTarUrl = prefix + '/raw.tar.gz',
      metaJsonUrl = prefix + '/meta.json';
    const norm = (s: string) =>
        s
          .normalize('NFKC')
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, ' ')
          .trim(),
      target = norm(p.scan.targetBusiness);
    const index = r.orderedBusinesses.findIndex((n) => norm(n) === target);
    await put(videoUrl, await readFile(join(dir, 'proof.webm')), 'video/webm');
    await put(
      dumpsTarUrl,
      await readFile(join(dir, 'raw.tar.gz')),
      'application/gzip',
    );
    await put(
      metaJsonUrl,
      JSON.stringify({
        surface: 'desktop_aimode',
        pinId: p.id,
        lat: p.lat,
        lng: p.lng,
        keyword: p.scan.keyword,
        capturedAt: new Date(),
        ...r,
      }),
      'application/json',
    );
    return {
      rankFound: index === -1 ? null : index + 1,
      topCompetitors: r.orderedBusinesses,
      hasAiOverview: true,
      targetCitedInAi: (' ' + norm(r.aiOverviewText) + ' ').includes(
        ' ' + target + ' ',
      ),
      aiOverviewText: r.aiOverviewText,
      aiCitations: r.aiCitations,
      videoUrl,
      dumpsTarUrl,
      metaJsonUrl,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
