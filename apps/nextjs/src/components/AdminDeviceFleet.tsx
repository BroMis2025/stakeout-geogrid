// apps/nextjs/src/app/(dashboard)/admin/devices/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Smartphone,
  Terminal,
  RefreshCw,
  Plus,
  Trash2,
  ShieldAlert,
  Server,
  Lock,
  Unlock,
  AlertTriangle,
} from 'lucide-react';
interface EnrichedDevice {
  imageId: string;
  proxyId: string;
  slotIndex: number;
  proxyPort: number;
  adbAddr: string | null;
  isEnabled: boolean;
  hardwareModel: string | null;
  cooldownUntil: string;
  runtimeState: 'IDLE' | 'BUSY' | 'COOLDOWN' | 'DISABLED';
  activePinId: string | null;
  lockTtlSec: number | null;
  cooldownRemainingSec: number;
}
export default function AdminDeviceFleetPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<EnrichedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [singleImageId, setSingleImageId] = useState('');
  const [singleProxyId, setSingleProxyId] = useState('');
  const [singleAdbAddr, setSingleAdbAddr] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  async function checkRoleAndFetchFleet() {
    try {
      const userRes = await fetch('/api/user/me', { cache: 'no-store' });
      if (!userRes.ok) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const userData = await userRes.json();
      if (userData?.role !== 'ADMIN') {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setIsAdmin(true);
      const res = await fetch('/api/admin/devices', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.devices)) setDevices(data.devices);
      }
      setLoading(false);
    } catch {
      setIsAdmin(false);
      setLoading(false);
    }
  }
  useEffect(() => {
    checkRoleAndFetchFleet();
    const interval = setInterval(() => {
      if (isAdmin) checkRoleAndFetchFleet();
    }, 4000);
    return () => clearInterval(interval);
  }, [isAdmin]);
  async function dispatchAdminAction(
    payload: Record<string, any>,
    label: string,
  ) {
    setActionBusy(label);
    setBannerMsg(null);
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Admin action failed');
      setBannerMsg({ type: 'ok', text: `Success: ${label}` });
      await checkRoleAndFetchFleet();
    } catch (err: any) {
      setBannerMsg({ type: 'err', text: err.message });
    } finally {
      setActionBusy(null);
    }
  }
  async function handleAddSingle(e: React.FormEvent) {
    e.preventDefault();
    if (!singleImageId.trim() || !singleProxyId.trim()) return;
    await dispatchAdminAction(
      {
        action: 'ADD_DEVICES',
        devices: [
          {
            imageId: singleImageId.trim(),
            proxyId: singleProxyId.trim(),
            adbAddr: singleAdbAddr.trim() || undefined,
          },
        ],
      },
      `Added DuoPlus Phone ${singleImageId.trim()}`,
    );
    setSingleImageId('');
    setSingleProxyId('');
    setSingleAdbAddr('');
  }
  async function handleAddBulk(e: React.FormEvent) {
    e.preventDefault();
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed = lines
      .map((line) => {
        const [imageId, proxyId, adbAddr] = line.split(/[\s,;]+/);
        return { imageId, proxyId, adbAddr };
      })
      .filter((p) => p.imageId && p.proxyId);
    if (parsed.length === 0) return;
    await dispatchAdminAction(
      { action: 'ADD_DEVICES', devices: parsed },
      `Registered ${parsed.length} DuoPlus Phones`,
    );
    setBulkText('');
    setShowBulkModal(false);
  }
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center bg-slate-950 text-slate-300 text-xs">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin text-emerald-400" />
        Verifying administrator credentials...
      </div>
    );
  }
  if (isAdmin === false) {
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full flex-col items-center justify-center bg-slate-950 p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/30">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-extrabold text-white">Restricted Access</h1>
        <p className="mt-1 max-w-sm text-xs text-slate-400">
          Sign in with an administrator account to manage phones.
        </p>
        <Link
          href="/scans"
          className="mt-6 rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
        >
          Return to Stakeout Scans
        </Link>
      </div>
    );
  }
  const idleCount = devices.filter((d) => d.runtimeState === 'IDLE').length;
  const busyCount = devices.filter((d) => d.runtimeState === 'BUSY').length;
  const cooldownCount = devices.filter(
    (d) => d.runtimeState === 'COOLDOWN',
  ).length;
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <Server className="h-6 w-6 text-emerald-400" />
              <h1 className="text-xl font-extrabold text-white">
                Admin DuoPlus Cloud Phone Fleet Manager
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Restricted Admin View • Manage `imageId` ↔ `proxyId` bindings,
              Redis locks, and 1-click bootstrap scripts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowBulkModal((prev) => !prev)}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs"
            >
              <Plus className="h-4 w-4 text-emerald-400" />
              Bulk Paste IDs
            </button>
            <button
              type="button"
              disabled={actionBusy !== null}
              onClick={() =>
                dispatchAdminAction(
                  { action: 'RESET_ALL_COOLDOWNS' },
                  'Cleared All Cooldowns & Redis Locks',
                )
              }
              className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5"
            >
              <Unlock className="h-4 w-4" />
              Clear All Cooldowns & Locks
            </button>
            <button
              type="button"
              disabled={actionBusy !== null || devices.length === 0}
              onClick={() =>
                dispatchAdminAction(
                  { action: 'BOOTSTRAP_ALL' },
                  'Bootstrapped All Enabled DuoPlus Phones',
                )
              }
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-extrabold"
            >
              <Terminal className="h-4 w-4" />
              1-Click Bootstrap All Phones
            </button>
          </div>
        </div>
        {bannerMsg && (
          <div
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-semibold font-semibold ${
              bannerMsg.type === 'ok'
                ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                : 'border-red-500/40 bg-red-950/40 text-red-300'
            }`}
          >
            <span>{bannerMsg.text}</span>
            <button
              type="button"
              onClick={() => setBannerMsg(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs text-slate-400">
              Total Registered Phones
            </div>
            <div className="mt-1 text-2xl font-extrabold text-white">
              {devices.length}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
            <div className="text-xs text-emerald-400">Idle & Ready</div>
            <div className="mt-1 text-2xl font-extrabold text-emerald-300">
              {idleCount}
            </div>
          </div>
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4">
            <div className="text-xs text-indigo-400">Active Leased</div>
            <div className="mt-1 text-2xl font-extrabold text-indigo-300">
              {busyCount}
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
            <div className="text-xs text-amber-400">In Cooldown</div>
            <div className="mt-1 text-2xl font-extrabold text-amber-300">
              {cooldownCount}
            </div>
          </div>
        </div>
        <form
          onSubmit={handleAddSingle}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
        >
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              DuoPlus Cloud Phone ID (`image_id`)
            </label>
            <input
              type="text"
              required
              placeholder="e.g., dp_img_987654"
              value={singleImageId}
              onChange={(e) => setSingleImageId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              DuoPlus Bound Proxy ID (`proxy_id`)
            </label>
            <input
              type="text"
              required
              placeholder="e.g., dp_prx_123456"
              value={singleProxyId}
              onChange={(e) => setSingleProxyId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
            />
          </div>
          <div className="w-56">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              ADB Address (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., 1.2.3.4:5555"
              value={singleAdbAddr}
              onChange={(e) => setSingleAdbAddr(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={actionBusy !== null}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950"
          >
            <Plus className="h-4 w-4" />
            Add Phone Pair
          </button>
        </form>
        {showBulkModal && (
          <form
            onSubmit={handleAddBulk}
            className="space-y-3 rounded-xl border border-emerald-500/30 bg-slate-900 p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400">
                Bulk Paste `imageId, proxyId` Pairs
              </span>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <textarea
              rows={5}
              placeholder={`dp_image_01, dp_proxy_01\ndp_image_02, dp_proxy_02`}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-white"
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
            >
              Import All Pairs
            </button>
          </form>
        )}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold uppercase">
              <tr>
                <th className="py-3.5 pl-6 pr-3">Slot & Port</th>
                <th className="px-3 py-3.5">`imageId`</th>
                <th className="px-3 py-3.5">`proxyId`</th>
                <th className="px-3 py-3.5">Redis Lease Status</th>
                <th className="py-3.5 pl-3 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    {loading ? 'Loading Fleet...' : 'No devices registered.'}
                  </td>
                </tr>
              ) : (
                devices.map((dev) => (
                  <tr key={dev.imageId} className="hover:bg-slate-950/40">
                    <td className="py-3.5 pl-6 pr-3 font-mono">
                      <span className="rounded bg-slate-800 px-2 py-1 font-bold text-slate-200">
                        #{dev.slotIndex}
                      </span>
                      <span className="ml-2 text-slate-400">
                        :{dev.proxyPort}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 font-mono font-semibold text-white">
                      {dev.imageId}
                    </td>
                    <td className="px-3 py-3.5 font-mono text-emerald-400">
                      {dev.proxyId}
                    </td>
                    <td className="px-3 py-3.5">
                      {dev.runtimeState === 'IDLE' && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />{' '}
                          IDLE
                        </span>
                      )}
                      {dev.runtimeState === 'BUSY' && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-2.5 py-1">
                          <RefreshCw className="h-3 w-3 animate-spin" /> BUSY (
                          {dev.lockTtlSec}s)
                        </span>
                      )}
                      {dev.runtimeState === 'COOLDOWN' && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1">
                          <AlertTriangle className="h-3 w-3" /> COOLDOWN (
                          {Math.ceil(dev.cooldownRemainingSec / 60)}m)
                        </span>
                      )}
                      {dev.runtimeState === 'DISABLED' && (
                        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] text-slate-400">
                          DISABLED
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pl-3 pr-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        <span className="mr-2 text-xs">
                          {dev.hardwareModel ?? 'Bootstrap needed'}
                        </span>
                        <button
                          className="mr-2 text-xs underline"
                          type="button"
                          onClick={() =>
                            dispatchAdminAction(
                              {
                                action: 'TOGGLE_ENABLED',
                                imageId: dev.imageId,
                                isEnabled: !dev.isEnabled,
                              },
                              dev.isEnabled ? 'Disable phone' : 'Enable phone',
                            )
                          }
                        >
                          {dev.isEnabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            dispatchAdminAction(
                              { action: 'BOOTSTRAP_ONE', imageId: dev.imageId },
                              `Bootstrapped ${dev.imageId}`,
                            )
                          }
                          className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px]"
                        >
                          Bootstrap
                        </button>
                        {(dev.runtimeState === 'COOLDOWN' ||
                          dev.runtimeState === 'BUSY') && (
                          <button
                            type="button"
                            onClick={() =>
                              dispatchAdminAction(
                                {
                                  action: 'RESET_COOLDOWN',
                                  imageId: dev.imageId,
                                },
                                `Unlocked ${dev.imageId}`,
                              )
                            }
                            className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-[11px]"
                          >
                            Unlock
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            dispatchAdminAction(
                              { action: 'DELETE_DEVICE', imageId: dev.imageId },
                              `Removed ${dev.imageId}`,
                            )
                          }
                          className="rounded-lg border border-red-500/30 bg-red-950/30 p-1.5 text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
