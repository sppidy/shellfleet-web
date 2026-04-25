'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuditRow } from '@/lib/types';
import { useSession } from '@/components/providers/SessionProvider';
import {
  ActivityIcon,
  ArrowLeftIcon,
  RefreshCwIcon,
  Loader2Icon,
  AlertCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from 'lucide-react';

const RELATIVE = (ts: number) => {
  if (!ts) return '—';
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86_400) return `${Math.floor(delta / 3_600)}h ago`;
  return `${Math.floor(delta / 86_400)}d ago`;
};

export default function ActivityPage() {
  const router = useRouter();
  const { status } = useSession();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/audit?limit=200', { credentials: 'same-origin' });
      if (res.status === 401) {
        window.location.href = '/auth/login';
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows((await res.json()) as AuditRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activity');
    }
  }, []);

  useEffect(() => {
    if (status === 'guest') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authed') fetchRows();
  }, [status, fetchRows]);

  if (status !== 'authed') {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <Loader2Icon className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="inline-flex items-center text-sm text-slate-400 hover:text-slate-100"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1.5" />
          Back to dashboard
        </button>
        <button
          type="button"
          onClick={fetchRows}
          className="inline-flex items-center gap-1.5 text-xs font-medium py-1 px-2.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <RefreshCwIcon className="w-3.5 h-3.5" />
          Refresh
        </button>
      </header>

      <main className="flex-1 px-6 py-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-1">
          <ActivityIcon className="w-5 h-5 text-blue-400" />
          <h1 className="text-2xl font-semibold">Activity</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Latest 200 events the server recorded — agent registers, device-auth
          approvals, token issues + revokes, and more as we add them.
        </p>

        {error && (
          <div className="mb-4 flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-md p-3">
            <AlertCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {rows === null ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2Icon className="w-5 h-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-md p-8 text-center text-slate-500 text-sm">
            No activity recorded yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800 border border-slate-800 rounded-md overflow-hidden">
            {rows.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-900 items-center"
              >
                <div className="col-span-2 text-xs text-slate-500" title={new Date(r.ts * 1000).toLocaleString()}>
                  {RELATIVE(r.ts)}
                </div>
                <div className="col-span-1 flex justify-center">
                  {r.ok ? (
                    <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircleIcon className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="col-span-3 font-mono text-xs text-slate-200 truncate" title={r.kind}>
                  {r.kind}
                </div>
                <div className="col-span-2 text-xs text-slate-400 truncate" title={r.actor ?? ''}>
                  {r.actor ?? <span className="text-slate-600">—</span>}
                </div>
                <div className="col-span-2 text-xs text-slate-400 truncate" title={r.agent_id ?? ''}>
                  {r.agent_id?.replace(/-id$/, '') ?? <span className="text-slate-600">—</span>}
                </div>
                <div
                  className="col-span-2 text-xs text-slate-500 truncate"
                  title={r.detail ?? ''}
                >
                  {r.detail ?? ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
