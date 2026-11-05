import test from 'node:test';
import assert from 'node:assert/strict';
import {
  proxyPort, proxyCredentials, proxySellerRead,
  proxyPackageSummary, proxyListsSummary,
} from '../packages/core/proxySeller';

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const transport = (r: Response) => (async () => r) as typeof fetch;

test('fleet ports are distinct and cannot silently wrap outside the provider range', () => {
  const env = { PROXY_USE_SLOT_PORT: 'true' };
  assert.equal(proxyPort(1, env), 10001);
  assert.equal(proxyPort(999, env), 10999);
  for (const slot of [0, -1, 1.5, 1000, NaN])
    assert.throws(() => proxyPort(slot, env), /PROXY_SLOT_OUT_OF_RANGE/);
  assert.equal(proxyPort(1, {}), 10000);
  for (const port of ['9999', '11000', '', 'NaN', '10000.5'])
    assert.throws(() => proxyPort(1, { PROXY_PORT: port }), /PROXY_PORT_OUT_OF_RANGE/);
});

test('missing connection credentials fail before generating an undefined proxy login', () => {
  assert.throws(() => proxyCredentials({}), /PROXY_CREDENTIALS_MISSING/);
  assert.throws(() => proxyCredentials({ PROXY_SELLER_BASE_LOGIN: 'x' }), /PROXY_CREDENTIALS_MISSING/);
});

test('management reads use the selected endpoint and block redirects', async () => {
  let requested = '';
  const request = (async (url, options) => {
    requested = String(url);
    assert.equal(options?.method, 'GET');
    assert.equal(options?.redirect, 'error');
    return response({ status: 'success', data: { items: [] }, errors: [] });
  }) as typeof fetch;
  await proxySellerRead('resident/lists', 'test-key', request);
  assert.ok(requested.endsWith('/resident/lists'));
  await proxySellerRead('proxy/lists', 'test-key', request);
  assert.ok(requested.endsWith('/proxy/lists'));
  await assert.rejects(proxySellerRead('resident/list/delete' as any, 'test-key', request), /UNSUPPORTED_READ/);
});

test('HTTP 200 business errors reject and never echo provider secrets', async () => {
  for (const body of [
    { status: 'error', data: null, errors: [{ message: 'secret-key secret-password' }] },
    { status: 'success', data: { items: [] }, errors: [{ message: 'secret-key' }] },
    { data: { items: [] } },
  ]) {
    await assert.rejects(
      proxySellerRead('resident/lists', 'secret-key', transport(response(body))),
      (error: Error) => /PROXY_SELLER_REJECTED/.test(error.message) && !/secret-/.test(error.message),
    );
  }
});

test('transport, status and invalid JSON failures keep secret URLs out of errors', async () => {
  const request = (async () => { throw new Error('https://provider/secret-key/ secret-password'); }) as typeof fetch;
  await assert.rejects(proxySellerRead('resident/package', 'secret-key', request),
    (error: Error) => /NETWORK_ERROR/.test(error.message) && !/secret-/.test(error.message) && !error.cause);
  await assert.rejects(proxySellerRead('resident/package', 'secret-key', transport(response({}, 403))), /HTTP_403/);
  await assert.rejects(proxySellerRead('resident/package', 'secret-key', transport(new Response('secret-key'))), /INVALID_JSON/);
});

test('operator summaries omit credentials and retain large byte counters without precision loss', () => {
  const summary = {
    package: proxyPackageSummary({ is_active: true, traffic_limit: '9007199254740993',
      traffic_left: '0', expired_at: '2026-12-01 23:59:59', package_key: 'secret-package' }),
    lists: proxyListsSummary({ items: [{ login: 'secret-login', password: 'secret-password',
      title: 'secret-title', whitelist: 'secret-whitelist' }] }, 'secret-login'),
  };
  assert.equal(summary.package.trafficLimitBytes, '9007199254740993');
  assert.equal(summary.package.trafficLeftBytes, '0');
  assert.equal(summary.lists.configuredLoginFound, true);
  assert.equal(JSON.stringify(summary).includes('secret-'), false);
  assert.equal(proxyListsSummary({ items: [] }, 'missing').configuredLoginFound, false);
  assert.throws(() => proxyListsSummary([]), /SHAPE_UNRECOGNIZED/);
});
