// apps/nextjs/src/app/(dashboard)/scans/compare/page.tsx
import React, { Suspense } from 'react';
import { GeoGridCompareView } from '@/components/GeoGridCompareView';
export default async function DashboardScanComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-400">
          Loading Stakeout Comparison Matrix...
        </div>
      }
    >
      <GeoGridCompareView
        initialScanAId={a}
        initialScanBId={b}
        isPublic={false}
      />
    </Suspense>
  );
}
