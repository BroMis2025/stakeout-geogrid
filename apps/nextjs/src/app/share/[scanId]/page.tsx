import { GeoGridDashboard } from '@/components/GeoGridDashboard';
export default async function Page({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  return <GeoGridDashboard identifier={(await params).scanId} shared />;
}
