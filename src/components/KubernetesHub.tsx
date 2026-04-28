'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from './providers/WebSocketProvider';
import type { K8sPod } from '@/lib/types';

type Props = { agentId: string };

function fmtAge(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function phaseStyle(phase: string): React.CSSProperties {
  switch (phase) {
    case 'Running':
      return { color: 'var(--ok, #7fb069)' };
    case 'Pending':
      return { color: 'var(--warn, #e6b450)' };
    case 'Succeeded':
      return { color: 'var(--fg-2)' };
    case 'Failed':
      return { color: 'var(--err, #e57373)' };
    default:
      return { color: 'var(--fg-3)' };
  }
}

export default function KubernetesHub({ agentId }: Props) {
  const { sendToAgent, onAgentMessage } = useWebSocket();
  const [pods, setPods] = useState<K8sPod[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    sendToAgent(agentId, { type: 'K8sListPodsRequest' });

    const unsub = onAgentMessage(agentId, (msg) => {
      if (msg.type === 'K8sListPodsResponse') {
        setLoading(false);
        if (msg.payload.error) {
          setError(msg.payload.error);
          setPods([]);
        } else {
          setError(null);
          setPods(msg.payload.pods);
        }
      }
    });

    // Auto-refresh every 5s. K8sListPodsRequest is cheap on the agent
    // side (one apiserver list call, no agent-side polling cost).
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => {
      unsub();
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  useEffect(() => {
    if (tick === 0) return;
    sendToAgent(agentId, { type: 'K8sListPodsRequest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="panel-head" style={{ flexShrink: 0 }}>
        <div className="panel-title">
          <span className="ico">⎈</span> KUBERNETES · pods
          <span className="meta">
            {loading ? 'loading…' : `${pods.length} pod${pods.length === 1 ? '' : 's'}`}
          </span>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--pad, 12px)' }}>
        {error ? (
          <div
            style={{
              padding: 16,
              fontFamily: 'var(--mono)',
              fontSize: 12,
              color: 'var(--err, #e57373)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {error}
          </div>
        ) : pods.length === 0 && !loading ? (
          <div
            style={{
              padding: 16,
              fontFamily: 'var(--mono)',
              fontSize: 12,
              color: 'var(--fg-3)',
            }}
          >
            no pods on this cluster yet
          </div>
        ) : (
          <table
            className="tbl"
            style={{
              width: '100%',
              fontFamily: 'var(--mono)',
              fontSize: 12,
              borderCollapse: 'collapse',
            }}
          >
            <thead>
              <tr style={{ color: 'var(--fg-3)', textAlign: 'left' }}>
                <th style={{ padding: '6px 10px' }}>namespace</th>
                <th style={{ padding: '6px 10px' }}>name</th>
                <th style={{ padding: '6px 10px' }}>ready</th>
                <th style={{ padding: '6px 10px' }}>status</th>
                <th style={{ padding: '6px 10px' }}>restarts</th>
                <th style={{ padding: '6px 10px' }}>age</th>
                <th style={{ padding: '6px 10px' }}>node</th>
              </tr>
            </thead>
            <tbody>
              {pods.map((p) => (
                <tr
                  key={`${p.namespace}/${p.name}`}
                  style={{ borderTop: '1px solid var(--line)' }}
                >
                  <td style={{ padding: '6px 10px', color: 'var(--fg-2)' }}>{p.namespace}</td>
                  <td style={{ padding: '6px 10px' }}>{p.name}</td>
                  <td style={{ padding: '6px 10px' }}>{p.ready}</td>
                  <td style={{ padding: '6px 10px', ...phaseStyle(p.phase) }}>{p.phase}</td>
                  <td style={{ padding: '6px 10px' }}>{p.restarts}</td>
                  <td style={{ padding: '6px 10px' }}>{fmtAge(p.age_secs)}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--fg-2)' }}>
                    {p.node ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
