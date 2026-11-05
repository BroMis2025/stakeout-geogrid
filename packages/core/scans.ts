import { randomBytes } from 'node:crypto';
import { db, Prisma } from '@stakeout/db';
import {
  buildGrid,
  campaignId,
  InputError,
  metrics,
  parseSpec,
  scheduleCron,
  type ScanSpec,
} from './grid';

export async function createScan(
  userId: string,
  s: ScanSpec,
  key: string,
  lead?: { email: string },
  templatePins?: ReturnType<typeof buildGrid>,
) {
  const prior = await db.gridScan.findUnique({ where: { requestKey: key } });
  if (prior) {
    if (prior.userId !== userId || prior.campaignId !== campaignId(userId, s))
      throw new InputError(
        'Request key already used for a different scan.',
        409,
      );
    return prior;
  }
  const pins = templatePins ?? buildGrid(s),
    middle = pins[(pins.length - 1) / 2];
  const cost = lead ? 0 : pins.length * (s.trackAiOverviews ? 2 : 1);
  try {
    return await db.$transaction(
      async (tx) => {
        const scan = await tx.gridScan.create({
          data: {
            ...s,
            userId,
            requestKey: key,
            campaignId: campaignId(userId, s),
            leadEmail: lead?.email,
            shareToken: lead ? randomBytes(24).toString('hex') : null,
            scheduleCron: scheduleCron(s.scheduleType),
            totalPins: pins.length,
            creditsCharged: cost,
            zip: middle.zip,
            city: middle.city,
            stateCode: middle.stateCode,
            pins: { create: pins },
          },
        });
        if (cost) {
          const debit = await tx.user.updateMany({
            where: { id: userId, creditBalance: { gte: cost } },
            data: { creditBalance: { decrement: cost } },
          });
          if (debit.count !== 1)
            throw new InputError('Insufficient credits for this scan.', 402);
          await tx.creditLedger.create({
            data: {
              userId,
              amount: -cost,
              reason: key.startsWith('cron:') ? 'RECURRING_HOLD' : 'SCAN_HOLD',
              scanId: scan.id,
            },
          });
        }
        return scan;
      },
      { timeout: 20000 },
    );
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      const existing = await db.gridScan.findUnique({
        where: { requestKey: key },
      });
      if (
        existing &&
        existing.campaignId === campaignId(userId, s) &&
        existing.userId === userId
      )
        return existing;
      if (existing)
        throw new InputError(
          'Request key already used for a different scan.',
          409,
        );
    }
    throw e;
  }
}

export async function settlePin(
  pinId: string,
  result: { data: Prisma.GridPinUpdateManyMutationInput } | { error: string },
) {
  await db.$transaction(
    async (tx) => {
      const pin = await tx.gridPin.findUniqueOrThrow({
        where: { id: pinId },
        include: { scan: true },
      });
      const failed = 'error' in result;
      const refund = failed ? pin.scan.creditsCharged / pin.scan.totalPins : 0;
      const update = await tx.gridPin.updateMany({
        where: { id: pinId, status: 'PENDING' },
        data: failed
          ? {
              status: 'FAILED',
              lastError: result.error.slice(0, 200),
              isRefunded: refund > 0,
            }
          : { ...result.data, status: 'COMPLETED' },
      });
      if (!update.count) return;
      const scan = await tx.gridScan.update({
        where: { id: pin.scanId },
        data: failed
          ? {
              failedPins: { increment: 1 },
              creditsRefunded: { increment: refund },
            }
          : { completedPins: { increment: 1 } },
      });
      if (refund) {
        await tx.creditLedger.create({
          data: {
            userId: scan.userId,
            amount: refund,
            reason: 'PIN_REFUND',
            pinId,
            scanId: scan.id,
          },
        });
        await tx.user.update({
          where: { id: scan.userId },
          data: { creditBalance: { increment: refund } },
        });
      }
      if (scan.completedPins + scan.failedPins === scan.totalPins) {
        const completed = await tx.gridPin.findMany({
          where: { scanId: scan.id, status: 'COMPLETED' },
          select: {
            rankFound: true,
            hasAiOverview: true,
            targetCitedInAi: true,
          },
        });
        await tx.gridScan.update({
          where: { id: scan.id },
          data: {
            ...metrics(completed),
            completedAt: new Date(),
            status: !completed.length
              ? 'FAILED'
              : scan.failedPins
                ? 'PARTIAL'
                : 'COMPLETED',
          },
        });
      }
    },
    { timeout: 20000 },
  );
}

/** A delivered BullMQ schedule occurrence is a single billable scan, even on replay. */
export async function cloneScheduledRun(
  templateScanId: string,
  occurrenceId: string,
) {
  const template = await db.gridScan.findUnique({
    where: { id: templateScanId },
    include: {
      pins: {
        select: {
          rowIdx: true,
          colIdx: true,
          lat: true,
          lng: true,
          zip: true,
          city: true,
          stateCode: true,
        },
        orderBy: [{ rowIdx: 'asc' }, { colIdx: 'asc' }],
      },
    },
  });
  if (
    !template ||
    !template.scheduleCron ||
    template.scheduleCron.startsWith('PAUSED:')
  )
    return null;
  if (template.pins.length !== template.totalPins)
    throw new Error('Template pin count mismatch.');
  try {
    return await createScan(
      template.userId,
      { ...parseSpec(template), scheduleType: 'once' },
      'cron:' + template.id + ':' + occurrenceId,
      undefined,
      template.pins,
    );
  } catch (e) {
    if (!(e instanceof InputError) || e.status !== 402) throw e;
    await db.gridScan.updateMany({
      where: { id: template.id, scheduleCron: template.scheduleCron },
      data: { scheduleCron: 'PAUSED:' + template.scheduleCron },
    });
    return null;
  }
}
