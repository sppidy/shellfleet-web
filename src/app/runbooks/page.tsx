'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/components/providers/SessionProvider';
import EeFeatureGate from '@/components/EeFeatureGate';
import { Loader2Icon } from 'lucide-react';

interface Runbook { id: number; name: string; description: string; steps: string; tags: string; created_by: string }
interface RunbookRun { id: number; runbook_id: number; agent_id: string; started_by: string; status: string; results: string; started_at: number; finished_at: number | null; error: string | null }
interface StepResult { step_index: number; name: string; status: string; exit_code?: number; stdout?: string; duration_ms?: number; error?: string }

const stepCount = (steps: string) => { try { return (JSON.parse(steps) as unknown[]).length; } catch { return 0; } };
const parseResults = (r: string): StepResult[] => { try { return JSON.parse(r) as StepResult[]; } catch { return []; } };
const fmtTs = (t: number) => new Date(t * 1000).toLocaleString();

export default function RunbooksPage() {
  const router = useRouter();
  const { role, status } = useSession();
  const [books, setBooks] = useState<Runbook[] | null>(null);
  const [runs, setRuns] = useState<RunbookRun[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [agent, setAgent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => { if (status === 'guest') router.replace('/login'); }, [status, router]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [b, r, t] = await Promise.all([
        apiFetch('/api/ee/runbooks'),
        apiFetch('/api/ee/runbooks/runs'),
        apiFetch('/api/tokens'),
      ]);
      if (b.ok) setBooks(await b.json()); else { setError(`HTTP ${b.status}`); setBooks([]); }
      if (r.ok) setRuns(await r.json());
      if (t.ok) {
        const toks: { hostname?: string }[] = await t.json();
        setAgents(toks.filter((x) => x.hostname).map((x) => `${x.hostname}-id`));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'failed'); setBooks([]); }
  }, []);

  useEffect(() => { if (status === 'authed') load(); }, [status, load]);

  const run = async (rb: Runbook) => {
    if (!agent) { setError('select a target agent first'); return; }
    setMsg(null); setError(null);
    try {
      const res = await apiFetch(`/api/ee/runbooks/${rb.id}/run`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent_id: agent }),
      });
      if (!res.ok) { setError(await res.text() || `HTTP ${res.status}`); return; }
      setMsg(`started "${rb.name}" on ${agent.replace(/-id$/, '')}`);
      setTimeout(load, 1500);
    } catch (e) { setError(e instanceof Error ? e.message : 'failed'); }
  };

  const statusColor = (s: string) => (s === 'completed' || s === 'ok' ? 'var(--accent)' : s === 'failed' ? 'var(--err)' : s === 'running' ? 'var(--warn)' : 'var(--fg-2)');

  if (status !== 'authed') return <div className="center-screen"><Loader2Icon className="w-6 h-6 animate-spin" style={{ color: 'var(--fg-2)' }} /></div>;
  if (role !== 'admin') return <div className="center-screen" style={{ flexDirection: 'column', gap: 12 }}><div className="mono" style={{ color: 'var(--err)' }}>/runbooks requires the admin role.</div><button className="btn" onClick={() => router.push('/')}>← back</button></div>;

  return (
    <div className="app-shell" style={{ gridTemplateColumns: '1fr' }}>
      <main className="main">
        <div className="topbar">
          <div className="breadcrumb">
            <span className="prompt">$</span>
            <button type="button" className="nav-item" onClick={() => router.push('/')} style={{ height: 'auto', padding: '0 4px', display: 'inline-flex' }}>←&nbsp;back</button>
            <span className="sep">/</span>
            <span className="here">runbooks</span>
          </div>
          <div className="topbar-actions">
            <select className="input" value={agent} onChange={(e) => setAgent(e.target.value)} style={{ width: 200 }}>
              <option value="">— target agent —</option>
              {agents.map((a) => <option key={a} value={a}>{a.replace(/-id$/, '')}</option>)}
            </select>
            <button className="btn" onClick={load}>↻ refresh</button>
          </div>
        </div>
        <div className="scroll">
          <EeFeatureGate feature="runbooks" label="Runbooks">
            <div className="pane">
              {error && <div className="panel" style={{ borderColor: 'var(--err-bd)', marginBottom: 12 }}><div className="panel-body" style={{ color: 'var(--err)' }}>{error}</div></div>}
              {msg && <div className="panel" style={{ borderColor: 'var(--accent-bd)', marginBottom: 12 }}><div className="panel-body" style={{ color: 'var(--accent)' }}>{msg}</div></div>}

              <div className="panel" style={{ marginBottom: 12 }}>
                <div className="panel-head"><div className="panel-title"><span className="ico">▦</span> RUNBOOKS</div></div>
                <div className="panel-body flush">
                  {books === null ? <div className="empty"><Loader2Icon className="w-5 h-5 animate-spin" /></div>
                    : books.length === 0 ? <div className="empty">No runbooks defined.</div> : (
                    <table className="tbl"><thead><tr><th>NAME</th><th>DESCRIPTION</th><th>STEPS</th><th style={{ width: 70 }}></th></tr></thead>
                      <tbody>{books.map((rb) => (
                        <tr key={rb.id}>
                          <td className="mono">{rb.name}</td>
                          <td className="mono muted">{rb.description || '—'}</td>
                          <td className="mono">{stepCount(rb.steps)}</td>
                          <td><button className="btn btn-sm btn-accent" disabled={!agent} onClick={() => run(rb)}>run</button></td>
                        </tr>
                      ))}</tbody></table>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-head"><div className="panel-title"><span className="ico">↻</span> RUN HISTORY</div></div>
                <div className="panel-body flush">
                  {runs.length === 0 ? <div className="empty">No runs yet.</div> : (
                    <table className="tbl"><thead><tr><th>WHEN</th><th>AGENT</th><th>BY</th><th>STATUS</th><th style={{ width: 70 }}></th></tr></thead>
                      <tbody>{runs.map((r) => {
                        const res = parseResults(r.results);
                        return (
                          <Fragment key={r.id}>
                            <tr>
                              <td className="mono muted" style={{ fontSize: 11 }}>{fmtTs(r.started_at)}</td>
                              <td className="mono">{r.agent_id.replace(/-id$/, '')}</td>
                              <td className="mono">{r.started_by}</td>
                              <td className="mono" style={{ color: statusColor(r.status) }}>{r.status}</td>
                              <td><button className="btn btn-sm" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>{expanded === r.id ? 'hide' : 'steps'}</button></td>
                            </tr>
                            {expanded === r.id && (
                              <tr><td colSpan={5} style={{ background: 'var(--bg)' }}>
                                {r.error && <div className="mono" style={{ color: 'var(--err)', fontSize: 12, marginBottom: 6 }}>{r.error}</div>}
                                {res.length === 0 ? <span className="mono muted" style={{ fontSize: 12 }}>no step results</span> : res.map((s) => (
                                  <div key={s.step_index} style={{ marginBottom: 6 }}>
                                    <span className="mono" style={{ color: statusColor(s.status), fontSize: 12 }}>[{s.status}]</span>{' '}
                                    <span className="mono" style={{ fontSize: 12 }}>{s.name}</span>
                                    {s.exit_code != null && <span className="mono muted" style={{ fontSize: 11 }}> (exit {s.exit_code})</span>}
                                    {(s.stdout || s.error) && <pre style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 160, overflow: 'auto' }}>{s.error || s.stdout}</pre>}
                                  </div>
                                ))}
                              </td></tr>
                            )}
                          </Fragment>
                        );
                      })}</tbody></table>
                  )}
                </div>
              </div>
            </div>
          </EeFeatureGate>
        </div>
      </main>
    </div>
  );
}
