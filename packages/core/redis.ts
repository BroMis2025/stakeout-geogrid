import Redis, { type RedisOptions } from 'ioredis';

let client: Redis | undefined;

function cleanRedisUrl(raw?: string): string {
  const trimmed = raw?.trim().replace(/^["']|["']$/g, '');
  if (!trimmed) throw new Error('REDIS_URL is required.');
  return trimmed;
}

export function redactRedisUrl(raw = process.env.REDIS_URL): string {
  try {
    const u = new URL(cleanRedisUrl(raw));
    return `${u.protocol}//${u.hostname}:${u.port || '6379'}`;
  } catch {
    return 'INVALID_OR_MISSING_REDIS_URL';
  }
}

export function buildRedisOptions(raw = process.env.REDIS_URL): RedisOptions {
  const url = cleanRedisUrl(raw);
  const parsed = new URL(url);
  const isTls =
    parsed.protocol === 'rediss:' || parsed.hostname.endsWith('.upstash.io');

  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    family: 0,
    ...(isTls ? { tls: { servername: parsed.hostname } } : {}),
    retryStrategy(times: number) {
      return Math.min(times * 500, 5000);
    },
  };
}

/**
 * Creates a fresh, dedicated IORedis connection (required for each BullMQ Worker).
 */
export function createRedisClient(label = 'redis'): Redis {
  const url = cleanRedisUrl(process.env.REDIS_URL);
  const target = redactRedisUrl(url);
  const instance = new Redis(url, buildRedisOptions(url));

  instance.on('error', (err: NodeJS.ErrnoException) => {
    console.error(`[${label}] Redis error (${target}):`, {
      name: err.name,
      message: err.message,
      code: err.code,
    });
  });

  return instance;
}

/**
 * Shared singleton Redis client for non-blocking Queue producers and rate limiters.
 */
export function redis(): Redis {
  return (client ??= createRedisClient('shared-redis'));
}

export async function duoplusPost(
  endpoint: string,
  payload: Record<string, unknown>,
) {
  const key = 'rl:duoplus:' + endpoint;
  while (!(await redis().set(key, '1', 'PX', 1150, 'NX'))) {
    await new Promise((resolve) =>
      setTimeout(resolve, 200 + Math.random() * 160),
    );
  }
  const response = await fetch('https://openapi.duoplus.net' + endpoint, {
    method: 'POST',
    headers: {
      'DuoPlus-API-Key': process.env.DUOPLUS_API_KEY!,
      'Content-Type': 'application/json',
      Lang: 'en',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error('DuoPlus ' + endpoint + ' HTTP ' + response.status);
  const result = await response.json();
  if (
    result.code !== 200 ||
    result.data?.fail?.length ||
    Object.values(result.data ?? {}).some((v: any) => v?.success === false)
  ) {
    throw new Error('DuoPlus rejected ' + endpoint);
  }
  return result;
}
