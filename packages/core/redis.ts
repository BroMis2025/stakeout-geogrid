import IORedis, { RedisOptions } from 'ioredis';
import { Queue } from 'bullmq';

export const PIN_QUEUE_NAME = 'stakeout-pins';
export const RECURRING_SCHEDULE_QUEUE_NAME = 'stakeout-recurring-schedules';

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
export function getRedisConnectionOptions(rawUrl = process.env.REDIS_URL): RedisOptions {
  const url = rawUrl?.trim();
  if (!url) {
    throw new Error('REDIS_URL environment variable is missing or empty.');
  }

  const parsed = new URL(url);
  const isTls = parsed.protocol === 'rediss:';

  return {
    host: parsed.hostname,
    port: Number(parsed.port || (isTls ? 6379 : 6379)),
    username: parsed.username ? decodeURIComponent(parsed.username) : 'default',
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,    // Required for Upstash serverless Redis
    family: 0,                  // Support IPv4 and IPv6 resolution on Railway/Vercel
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
      name: err?.name || 'Error',
      message: err?.message || String(err),
      code: err?.code ?? undefined,
      syscall: err?.syscall ?? undefined,
    });
  });

  return client;
}

// Shared singleton connection for producers / API routes
let sharedConnection: IORedis | null = null;

export function getSharedRedisConnection(): IORedis {
  if (!sharedConnection) {
    sharedConnection = createRedisConnection('shared-producer');
  }
  return sharedConnection;
}

let pinQueueInstance: Queue | null = null;
let recurringQueueInstance: Queue | null = null;

export function getPinQueue(): Queue {
  if (!pinQueueInstance) {
    pinQueueInstance = new Queue(PIN_QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
    });
  }
  return pinQueueInstance;
}

export function getRecurringScheduleQueue(): Queue {
  if (!recurringQueueInstance) {
    recurringQueueInstance = new Queue(RECURRING_SCHEDULE_QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
    });
  }
  return recurringQueueInstance;
}
