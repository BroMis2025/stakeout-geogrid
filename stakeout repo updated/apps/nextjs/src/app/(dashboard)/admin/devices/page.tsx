import { forbidden } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth';
import Fleet from '@/components/AdminDeviceFleet';
export default async function Devices() {
  if ((await getAuthenticatedUser()).role !== 'ADMIN') forbidden();
  return <Fleet />;
}
