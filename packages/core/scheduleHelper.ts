import type { Queue } from 'bullmq';
export async function registerStakeoutSchedule(
  queue: Queue,
  templateScanId: string,
  cron: string,
) {
  return queue.upsertJobScheduler(
    'schedule-' + templateScanId,
    { pattern: cron, tz: 'UTC' },
    {
      name: 'repeat-scan',
      data: { templateScanId },
      opts: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 4000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      },
    },
  );
}
