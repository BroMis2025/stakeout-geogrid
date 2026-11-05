import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth';
import { UserSessionBadge } from '@/components/UserSessionBadge';
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser().catch(() => null);
  if (!user) redirect('/login');
  return (
    <div className="min-h-screen">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-5 py-3">
        <nav className="flex flex-wrap items-center gap-5 text-sm">
          <Link
            href="/scans"
            className="font-black tracking-widest text-emerald-400"
          >
            STAKEOUT
          </Link>
          <Link href="/new-scan">New scan</Link>
          <Link href="/scans">Scans & schedules</Link>
          {user.role === 'ADMIN' && (
            <Link href="/admin/devices">Device fleet</Link>
          )}
        </nav>
        <UserSessionBadge />
      </header>
      <main>{children}</main>
    </div>
  );
}
