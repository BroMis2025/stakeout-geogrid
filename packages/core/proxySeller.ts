type Settings = Record<string, string | undefined>;

/** Shared by fleet display and the worker so displayed and used ports agree. */
export function proxyPort(slotIndex: number, env: Settings = process.env) {
  const slots = env.PROXY_USE_SLOT_PORT === 'true';
  if (slots && (!Number.isSafeInteger(slotIndex) || slotIndex < 1 || slotIndex > 999))
    throw new Error('PROXY_SLOT_OUT_OF_RANGE: slot ports require a slot from 1 to 999.');
  const port = slots ? 10000 + slotIndex : Number(env.PROXY_PORT ?? 10000);
  if (!Number.isSafeInteger(port) || port < 10000 || port > 10999)
    throw new Error('PROXY_PORT_OUT_OF_RANGE: use a port from 10000 to 10999.');
  return port;
}

export function proxyCredentials(env: Settings = process.env) {
  const login = env.PROXY_SELLER_BASE_LOGIN?.trim();
  const password = env.PROXY_SELLER_PASSWORD;
  if (!login || !password)
    throw new Error('PROXY_CREDENTIALS_MISSING: configure the API Tools login and password.');
  return { login, password };
}

const readPaths = ['resident/package', 'resident/lists', 'proxy/lists'] as const;
export type ProxySellerReadPath = (typeof readPaths)[number];

/** Management reads only. Never include request URLs, payloads, or causes in errors. */
export async function proxySellerRead(
  path: ProxySellerReadPath,
  apiKey: string,
  request: typeof fetch = fetch,
): Promise<unknown> {
  if (!readPaths.includes(path)) throw new Error('PROXY_SELLER_UNSUPPORTED_READ');
  if (!apiKey || /\s/.test(apiKey)) throw new Error('PROXY_SELLER_API_KEY_MISSING_OR_INVALID');
  let response: Response;
  try {
    response = await request(
      'https://proxy-seller.com/personal/api/v2/' + encodeURIComponent(apiKey) + '/' + path,
      { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(20000) },
    );
  } catch {
    throw new Error('PROXY_SELLER_NETWORK_ERROR: check network access and the API IP allowlist.');
  }
  if (!response.ok) throw new Error('PROXY_SELLER_HTTP_' + response.status);
  let result: any;
  try {
    result = await response.json();
  } catch {
    throw new Error('PROXY_SELLER_INVALID_JSON');
  }
  if (
    !result || result.status !== 'success' || result.data == null ||
    (result.errors !== undefined && (!Array.isArray(result.errors) || result.errors.length > 0))
  ) {
    // The provider can return HTTP 200 for authentication, quota and other errors.
    throw new Error('PROXY_SELLER_REJECTED: check the API key, API IP allowlist, package and endpoint.');
  }
  return result.data;
}

/** Deliberately omit credentials, package keys, titles, whitelist and raw payloads. */
export function proxyPackageSummary(value: unknown) {
  const p = value as Record<string, unknown> | null;
  if (!p || typeof p !== 'object' || typeof p.is_active !== 'boolean')
    throw new Error('PROXY_SELLER_PACKAGE_SHAPE_UNRECOGNIZED');
  const bytes = (v: unknown) => {
    const text = String(v ?? '');
    return /^\d+$/.test(text) ? text : null;
  };
  const expiry = typeof p.expired_at === 'string' &&
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(p.expired_at)
    ? p.expired_at : null;
  return {
    active: p.is_active,
    trafficLimitBytes: bytes(p.traffic_limit),
    trafficUsedBytes: bytes(p.traffic_usage),
    trafficLeftBytes: bytes(p.traffic_left),
    expiresAtAsReported: expiry,
    expiryTimezone: 'Confirm with provider when no offset is present.',
  };
}

export function proxyListsSummary(value: unknown, configuredLogin?: string) {
  const items = (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) throw new Error('PROXY_SELLER_LIST_SHAPE_UNRECOGNIZED');
  return {
    listCount: items.length,
    configuredLoginFound: configuredLogin
      ? items.some((item) => item && item.login === configuredLogin)
      : null,
  };
}
