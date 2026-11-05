import Link from 'next/link';
export default function Forbidden() {
  return (
    <main className="mx-auto max-w-xl space-y-3 p-8">
      <h1 className="text-2xl font-bold">Administrator access required</h1>
      <p>Your agency can manage scans from the dashboard.</p>
      <Link href="/scans" className="text-emerald-400">
        Return to scans
      </Link>
    </main>
  );
}
