import IORedis, { RedisOptions } from 'ioredis';

/**
 * Returns a sanitized host description for safe logging without exposing credentials.
 */
export function getRedactedRedisTarget(rawUrl?: string): string {
  if (!rawUrl) return 'MISSING_REDIS_URL';
  try {
    const parsed = new URL(rawUrl.trim());
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || '6379'}`;
  } catch {
    return 'INVALID_REDIS_URL_FORMAT';
  }
}

/**
 * Builds BullMQ-compatible IORedis options for Upstash / TLS Redis instances.
 */
export function getRedisConnectionOptions(): RedisOptions {
  const rawUrl = process.env.REDIS_URL?.trim();
  if (!rawUrl) {
    throw new Error('REDIS_URL environment variable is missing or empty.');
  }

  const parsed = new URL(rawUrl);
  const isTls = parsed.protocol === 'rediss:';

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username ? decodeURIComponent(parsed.username) : 'default',
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,    // Required for Upstash serverless Redis
    family: 0,                  // Support both IPv4 and IPv6 on Railway
    ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
    retryStrategy(times: number) {
      return Math.min(times * 500, 5000);
    },
  };
}

/**
 * Creates a dedicated IORedis client instance for BullMQ Queues or Workers.
 */
export function createRedisConnection(label = 'default'): IORedis {
  const target = getRedactedRedisTarget(process.env.REDIS_URL);
  const client = new IORedis(getRedisConnectionOptions());

  client.on('connect', () => {
    console.log(`[redis:${label}] Connected to ${target}`);
  });

  client.on('error', (err: any) => {
    console.error(`[redis:${label}] Connection error (${target}):`, {
      name: err?.name,
      message: err?.message || String(err),
      code: err?.code,
      syscall: err?.syscall,
    });
  });

  return client;
}
