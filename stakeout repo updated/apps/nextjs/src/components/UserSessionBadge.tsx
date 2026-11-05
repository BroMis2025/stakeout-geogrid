// apps/nextjs/src/components/UserSessionBadge.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, LogOut, User } from 'lucide-react';
export function UserSessionBadge() {
  const router = useRouter();
  const [user, setUser] = useState<{
    email: string;
    name?: string;
    creditBalance: number;
  } | null>(null);
  useEffect(() => {
    const update = () =>
      fetch('/api/user/me', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.email) setUser(data);
        })
        .catch(() => {});
    void update();
    window.addEventListener('balance-change', update);
    return () => window.removeEventListener('balance-change', update);
  }, []);
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
  if (!user) return null;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-1">
        <Coins className="h-3.5 w-3.5" />
        <span>{user.creditBalance.toLocaleString()} Cr</span>
      </div>
      <div className="hidden items-center gap-1.5 text-xs text-slate-300 sm:flex">
        <User className="h-3.5 w-3.5 text-slate-500" />
        <span className="max-w-[160px] truncate font-medium">
          {user.name || user.email}
        </span>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs"
        title="Sign Out"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Sign Out</span>
      </button>
    </div>
  );
}
