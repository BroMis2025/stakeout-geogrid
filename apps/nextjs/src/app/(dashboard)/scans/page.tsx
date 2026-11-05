'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
type Run = {
  id: string;
  targetBusiness: string;
  keyword: string;
  createdAt: string;
  status: string;
  scheduleType: string;
  scheduleCron: string | null;
  solv: number | null;
  totalPins: number;
  completedPins: number;
  failedPins: number;
  creditsCharged: number;
  creditsRefunded: number;
  prevScanId: string | null;
};
export default function ScanList() {
  const [runs, setRuns] = useState<Run[]>([]),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState(false);
  async function load() {
    try {
      const r = await fetch('/api/scans', { cache: 'no-store' }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setRuns(d.scans);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    void load();
    const t = setInterval(load, 7000);
    return () => clearInterval(t);
  }, []);
  async function schedule(s: Run) {
    const r = await fetch('/api/scans/' + s.id, {
      method: 'POST',
      body: JSON.stringify({
        action: s.scheduleCron?.startsWith('PAUSED') ? 'resume' : 'pause',
      }),
    });
    if (r.ok) await load();
    else setError('Schedule update failed.');
  }
  return (
    <section className="mx-auto max-w-7xl space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Scans & schedules</h1>
        <Link
          className="rounded bg-emerald-400 px-4 py-2 font-bold text-slate-950"
          href="/new-scan"
        >
          New scan
        </Link>
      </div>
      {error && <p role="alert">{error}</p>}
      {!loaded ? (
        <p>Loading scans…</p>
      ) : !runs.length ? (
        <p>Your first scan will appear here.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  'Business / query',
                  'Started',
                  'Progress',
                  'SoLV',
                  'Credits',
                  'Schedule',
                  'Reports',
                ].map((h) => (
                  <th key={h} className="p-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((s) => (
                <tr key={s.id} className="border-t border-slate-800">
                  <td className="p-3">
                    <strong>{s.targetBusiness}</strong>
                    <br />
                    {s.keyword}
                  </td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>
                    {s.status}
                    <br />
                    {s.completedPins}/{s.totalPins} completed · {s.failedPins}{' '}
                    failed
                  </td>
                  <td>{s.solv == null ? '—' : s.solv + '%'}</td>
                  <td>
                    {s.creditsCharged} charged
                    <br />
                    {s.creditsRefunded} refunded
                  </td>
                  <td>
                    {s.scheduleType}
                    {s.scheduleType !== 'once' && (
                      <button
                        className="ml-2 underline"
                        onClick={() => schedule(s)}
                      >
                        {s.scheduleCron?.startsWith('PAUSED')
                          ? 'Resume'
                          : 'Pause'}
                      </button>
                    )}
                  </td>
                  <td>
                    <Link href={'/scans/' + s.id}>View grid</Link>
                    {s.prevScanId &&
                      ['COMPLETED', 'PARTIAL'].includes(s.status) && (
                        <Link
                          className="block text-emerald-400"
                          href={
                            '/scans/compare?a=' + s.prevScanId + '&b=' + s.id
                          }
                        >
                          Compare vs. previous
                        </Link>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
