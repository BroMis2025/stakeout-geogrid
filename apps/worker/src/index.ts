import { Worker, Job } from 'bullmq';
import {
  PIN_QUEUE_NAME,
  RECURRING_SCHEDULE_QUEUE_NAME,
  createRedisConnection,
  getRedactedRedisTarget,
} from '@stakeout/core/redis';
import * as mobileRunner from './mobile';
import * as desktopRunner from './desktop';
import * as recurringRunner from './recurring';

export interface PinJobData {
  pinId: string;
  scanId?: string;
  surface?: string;
  deviceType?: string;
  [key: string]: unknown;
}

export interface RecurringScheduleJobData {
  scheduleId?: string;
  scanId?: string;
  [key: string]: unknown;
}

/**
 * Serializes Error objects so Railway logs display the exact message, code, and stack
 * instead of a generic "Error" string.
 */
function formatWorkerError(err: unknown) {
  if (err instanceof Error) {
    const anyErr = err as any;
    return {
      name: err.name,
      message: err.message,
      code: anyErr.code ?? undefined,
      syscall: anyErr.syscall ?? undefined,
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    };
  }
  return { raw: String(err) };
}

/**
 * Resolves the pin processor from ./mobile (and ./desktop if applicable)
 * across whichever export signature exists in the worker modules.
 */
async function dispatchPinJob(job: Job<PinJobData>) {
  const data = job.data || ({} as PinJobData);
  const pinId = data.pinId || (job.id as string);

  // Route desktop jobs if surface/deviceType explicitly targets desktop
  if (
    data.surface === 'DESKTOP' ||
    data.deviceType === 'DESKTOP'
  ) {
    const desktopFn =
      (desktopRunner as any).processDesktopPinJob ||
      (desktopRunner as any).runDesktopPin ||
      (desktopRunner as any).executeDesktopPin ||
      (desktopRunner as any).default;

    if (typeof desktopFn === 'function') {
      return await desktopFn(job.data, job);
    }
  }

  // Default to mobile DuoPlus / Android runner
  const mobileFn =
    (mobileRunner as any).processPinJob ||
    (mobileRunner as any).runMobilePin ||
    (mobileRunner as any).executePinJob ||
    (mobileRunner as any). executePin ||
    (mobileRunner as any).processPin ||
    (mobileRunner as any).default;

  if (typeof mobileFn !== 'function') {
    throw new Error(
      `No callable pin handler export found in ./mobile (keys: ${Object.keys(mobileRunner).join(', ')})`
    );
  }

  // Support handlers expecting either (job) or (pinId / job.data)
  if (mobileFn.length === 1 && typeof pinId === 'string' && !('data' in mobileFn)) {
    try {
      return await mobileFn(job.data);
    } catch (err: any) {
      if (err?.message?.includes('pinId')) {
        return await mobileFn(pinId);
      }
      throw err;
    }
  }

  return await mobileFn(job.data, job);
}

/**
 * Resolves the recurring schedule processor from ./recurring.
 */
async function dispatchRecurringJob(job: Job<RecurringScheduleJobData>) {
  const recurringFn =
    (recurringRunner as any).processRecurringScheduleJob ||
    (recurringRunner as any).processRecurringSchedule ||
    (recurringRunner as any).runRecurringSchedule ||
    (recurringRunner as any).handleRecurringJob ||
    (recurringRunner as any).default;

  if (typeof recurringFn !== 'function') {
    throw new Error(
      `No callable recurring schedule handler found in ./recurring (keys: ${Object.keys(recurringRunner).join(', ')})`
    );
  }

  return await recurringFn(job.data, job);
}

async function startWorkers() {
  const target = getRedactedRedisTarget(process.env.REDIS_URL);
  const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY || 1));

  console.log(
    `[worker] Booting Stakeout workers (concurrency=${concurrency}) against Redis target: ${target}`
  );

  //Each BullMQ Worker requires its own dedicated blocking IORedis connection
  const pinsConnection = createRedisConnection(`worker:${PIN_QUEUE_NAME}`);
  const schedulesConnection = createRedisConnection(`worker:${RECURRING_SCHEDULE_QUEUE_NAME}`);

  const pinsWorker = new Worker<PinJobData>(
    PIN_QUEUE_NAME,
    async (job) => {
      console.log(`[${PIN_QUEUE_NAME}] Processing job ${job.id}`, {
        pinId: job.data?.pinId,
        scanId: job.data?.scanId,
      });
      return await dispatchPinJob(job);
    },
    {
      connection: pinsConnection,
      concurrency,
    }
  );

  pinsWorker.on('ready', () => {
    console.log(`[${PIN_QUEUE_NAME}] Worker ready and listening for pin jobs.`);
  });

  pinsWorker.on('completed', (job) => {
    console.log(`[${PIN_QUEUE_NAME}] Job ${job.id} completed.`);
  });

  pinsWorker.on('failed', (job, err) => {
    console.error(
      `[${PIN_QUEUE_NAME}] Job ${job?.id ?? 'unknown'} failed:`,
      formatWorkerError(err)
    );
  });

  pinsWorker.on('error', (err) => {
    console.error(
      `[${PIN_QUEUE_NAME}] Worker/Redis Error:`,
      formatWorkerError(err)
    );
  });

  const schedulesWorker = new Worker<RecurringScheduleJobData>(
    RECURRING_SCHEDULE_QUEUE_NAME,
    async (job) => {
      console.log(`[${RECURRING_SCHEDULE_QUEUE_NAME}] Processing schedule job ${job.id}`, {
        scheduleId: job.data?.scheduleId,
        scanId: job.data?.scanId,
      });
      return await dispatchRecurringJob(job);
    },
    {
      connection: schedulesConnection,
      concurrency: 1,
    }
  );

  schedulesWorker.on('ready', () => {
    console.log(
      `[${RECURRING_SCHEDULE_QUEUE_NAME}] Worker ready and listening for recurring schedule jobs.`
    );
  });

  schedulesWorker.on('completed', (job) => {
    console.log(`[${RECURRING_SCHEDULE_QUEUE_NAME}] Schedule job ${job.id} completed.`);
  });

  schedulesWorker.on('failed', (job, err) => {
    console.error(
      `[${RECURRING_SCHEDULE_QUEUE_NAME}] Schedule job ${job?.id ?? 'unknown'} failed:`,
      formatWorkerError(err)
    );
  });

  schedulesWorker.on('error', (err) => {
    console.error(
      `[${RECURRING_SCHEDULE_QUEUE_NAME}] Worker/Redis Error:`,
      formatWorkerError(err)
    );
  });

  // Graceful shutdown for Railway SIGTERM / SIGINT container restarts
  const shutdown = async (signal: string) => {
    console.log(`[worker] Received ${signal}. Closing BullMQ workers cleanly...`);
    await Promise.allSettled([pinsWorker.close(), schedulesWorker.close()]);
    await Promise.allSettled([pinsConnection.quit(), schedulesConnection.quit()]);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

startWorkers().catch((err) => {
  console.error('[worker] Fatal startup error:', formatWorkerError(err));
  process.exit(1);
});
