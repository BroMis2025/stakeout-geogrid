import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSpec,
  buildGrid,
  metrics,
  scheduleCron,
  campaignId,
} from '@stakeout/core/grid';
import { parsePinXmlBundle } from '../apps/worker/src/xmlParser';
import { shellQuote } from '@stakeout/core/runner';
import { execFileSync } from 'node:child_process';
const spec = parseSpec({
  keyword: 'emergency plumber',
  targetBusiness: 'Polk Plumbing',
  centerLat: 28.039465,
  centerLng: -81.949804,
  gridSize: 3,
});
test('paid grid and teaser use the same US geometry', () => {
  const p = buildGrid(spec);
  assert.equal(p.length, 9);
  assert.deepEqual([p[4].lat, p[4].lng], [spec.centerLat, spec.centerLng]);
  assert.ok(p[0].lat > p[8].lat && p[0].lng < p[8].lng);
  assert.ok(p.every((pin) => pin.stateCode === 'FL'));
});
test('121-pin campaign grid has 121 unique points', () => {
  const p = buildGrid({ ...spec, gridSize: 11 });
  assert.equal(new Set(p.map((v) => [v.lat, v.lng].join(','))).size, 121);
});
test('invalid surfaces, coordinates, hardware and even-sized grids fail closed', () => {
  for (const patch of [
    { gridSize: 4 },
    { centerLat: NaN },
    { phoneModel: 'unregistered-model' },
    { targetType: 'bogus' },
  ])
    assert.throws(() => parseSpec({ ...spec, ...patch }));
});
test('schedules use UTC and campaign comparisons preserve geometry', () => {
  assert.equal(scheduleCron('daily'), '0 13 * * *');
  assert.equal(scheduleCron('weekly'), '0 13 * * 1');
  assert.notEqual(campaignId('a', spec), campaignId('b', spec));
  assert.notEqual(
    campaignId('a', spec),
    campaignId('a', { ...spec, centerLat: 28.04 }),
  );
});
test('missing ranks count as 21 for ATRP, failed observations are excluded by the caller', () => {
  assert.deepEqual(
    metrics([
      { rankFound: 1, hasAiOverview: true, targetCitedInAi: true },
      { rankFound: null, hasAiOverview: false, targetCitedInAi: false },
    ]),
    { arp: 1, atrp: 11, solv: 50, aioTriggerRate: 50, aioCitationRate: 50 },
  );
  assert.equal(metrics([]).solv, null);
});
const xml = (nodes: string) =>
  '<hierarchy><node>' + nodes + '</node></hierarchy>';
const name = (s: string) =>
  '<node resource-id="com.google.android.apps.maps:id/place_name" text="' +
  s +
  '"/>';
test('ordered XML deduplicates scrolls and scopes citations to the AI panel', () => {
  const a = xml(name('Bay Plumbing') + name('Polk Plumbing')),
    panel = xml(
      '<node text="outside.example"/><node resource-id="ai_overview"><node text="AI Overview"/><node text="Try Polk Plumbing today"/><node resource-id="source_name" text="polk.example"/></node>',
    );
  const r = parsePinXmlBundle([a, a], [panel], 'Polk Plumbing');
  assert.equal(r.targetRank, 2);
  assert.equal(r.targetCitedInAi, true);
  assert.deepEqual(r.aiCitations, ['polk.example']);
  assert.equal(r.orderedBusinesses.length, 2);
  assert.ok(!r.aiOverviewText.includes('outside.example'));
});
test('an organic name outside the AI panel cannot trigger an AI citation', () => {
  const r = parsePinXmlBundle(
    [xml(name('Polk Plumbing'))],
    [
      xml(
        name('Polk Plumbing') +
          '<node resource-id="ai_overview"><node text="AI Overview"/><node text="Bay Plumbing is open"/></node>',
      ),
    ],
    'Polk Plumbing',
  );
  assert.equal(r.hasAiOverview, true);
  assert.equal(r.targetCitedInAi, false);
});
test('unknown layouts and challenges are distinct from a measured empty result', () => {
  assert.throws(
    () => parsePinXmlBundle([xml('<node text="Loading"/>')], [], 'Target'),
    /UNRECOGNIZED/,
  );
  assert.throws(
    () =>
      parsePinXmlBundle([xml('<node text="Unusual traffic"/>')], [], 'Target'),
    /CAPTCHA/,
  );
  assert.equal(
    parsePinXmlBundle([xml('<node text="No results found"/>')], [], 'Target')
      .targetRank,
    null,
  );
});
test('operator and user strings are passed literally to the Android shell', () => {
  const value = "Bob's & Sons $(echo unsafe)";
  assert.equal(
    execFileSync('sh', ['-c', "printf '%s' " + shellQuote(value)], {
      encoding: 'utf8',
    }),
    value,
  );
});
