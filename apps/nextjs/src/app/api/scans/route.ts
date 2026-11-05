import { db } from '@stakeout/db';
import { getAuthenticatedUser } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    const scans = await db.gridScan.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        keyword: true,
        targetBusiness: true,
        campaignId: true,
        status: true,
        totalPins: true,
        completedPins: true,
        failedPins: true,
        createdAt: true,
        solv: true,
        scheduleType: true,
        scheduleCron: true,
        creditsCharged: true,
        creditsRefunded: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return Response.json({
      scans: scans.map((s, i) => ({
        ...s,
        prevScanId:
          scans
            .slice(i + 1)
            .find(
              (p) =>
                p.campaignId === s.campaignId &&
                ['PARTIAL', 'COMPLETED'].includes(p.status),
            )?.id ?? null,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
