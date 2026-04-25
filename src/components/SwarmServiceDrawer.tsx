'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from './providers/WebSocketProvider';
import { SwarmServiceInspectPayload } from '@/lib/types';
import { XIcon, Loader2Icon, AlertCircleIcon, RefreshCwIcon } from 'lucide-react';

export default function SwarmServiceDrawer({
  agentId,
  serviceName,
  onClose,
}: {
  agentId: string;
  serviceName: string;
  onClose: () => void;
}) {
  const { sendToAgent, onAgentMessage } = useWebSocket();
  const [data, setData] = useState<SwarmServiceInspectPayload | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    setData(null);
    setUnsupported(false);

    const unsub = onAgentMessage(agentId, (msg) => {
      if (msg.type === 'SwarmServiceInspectResponse' && msg.payload.name === serviceName) {
        setData(msg.payload);
      }
    });

    sendToAgent(agentId, {
      type: 'SwarmServiceInspectRequest',
      payload: { name: serviceName },
    });

    const timeout = setTimeout(() => setUnsupported(true), 8000);
    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, [agentId, serviceName, sendToAgent, onAgentMessage]);

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-l border-slate-800 shadow-2xl w-full max-w-2xl h-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-slate-500">Swarm service</div>
            <div className="text-base font-semibold truncate">{serviceName}</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                sendToAgent(agentId, {
                  type: 'SwarmServiceInspectRequest',
                  payload: { name: serviceName },
                })
              }
              title="Refresh"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            >
              <RefreshCwIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              title="Close"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!data ? (
            unsupported ? (
              <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md p-3">
                <AlertCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Inspect not supported on this agent. Upgrade to the latest
                  sys-manager-agent.
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <Loader2Icon className="w-5 h-5 animate-spin" />
              </div>
            )
          ) : !data.success ? (
            <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-md p-3">
              <AlertCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{data.error ?? 'inspect failed'}</span>
            </div>
          ) : (
            <>
              {data.spec && <SpecBlock spec={data.spec} />}
              <TasksBlock tasks={data.tasks} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SpecBlock({ spec }: { spec: NonNullable<SwarmServiceInspectPayload['spec']> }) {
  return (
    <section>
      <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Spec</h4>
      <dl className="grid grid-cols-3 gap-y-1 gap-x-3 text-sm">
        <Row label="Image" value={spec.image} mono />
        {spec.image_digest && <Row label="Digest" value={spec.image_digest} mono small />}
        <Row
          label="Mode"
          value={
            spec.mode === 'replicated' && spec.replicas !== null
              ? `replicated · ${spec.replicas}`
              : spec.mode
          }
        />
        {spec.created_at && <Row label="Created" value={spec.created_at} small />}
        {spec.updated_at && <Row label="Updated" value={spec.updated_at} small />}
      </dl>
      {spec.published_ports.length > 0 && (
        <ListBlock label="Published ports" items={spec.published_ports} />
      )}
      {spec.networks.length > 0 && <ListBlock label="Networks" items={spec.networks} />}
      {spec.constraints.length > 0 && (
        <ListBlock label="Constraints" items={spec.constraints} />
      )}
      {spec.mounts.length > 0 && <ListBlock label="Mounts" items={spec.mounts} />}
      {spec.env.length > 0 && <ListBlock label="Environment" items={spec.env} />}
    </section>
  );
}

function TasksBlock({ tasks }: { tasks: SwarmServiceInspectPayload['tasks'] }) {
  if (tasks.length === 0) {
    return (
      <section>
        <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Tasks</h4>
        <div className="text-sm text-slate-500 border border-dashed border-slate-800 rounded-md p-4">
          No task records.
        </div>
      </section>
    );
  }
  return (
    <section>
      <h4 className="text-xs uppercase tracking-wide text-slate-500 mb-2">
        Tasks ({tasks.length})
      </h4>
      <ul className="divide-y divide-slate-800 border border-slate-800 rounded-md overflow-hidden">
        {tasks.map((t) => (
          <li key={t.id} className="px-3 py-2 bg-slate-950/50">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-[11px] text-slate-500">{t.id.slice(0, 12)}</code>
              <span className="font-medium text-slate-100 text-sm">{t.name}</span>
              <span className="text-xs text-slate-500">on {t.node || '—'}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
              <span>
                desired{' '}
                <span className="text-slate-300">{t.desired_state}</span>
              </span>
              <span>
                current{' '}
                <span
                  className={
                    t.current_state.startsWith('Running')
                      ? 'text-emerald-300'
                      : t.current_state.startsWith('Failed') || t.current_state.startsWith('Rejected')
                        ? 'text-red-300'
                        : 'text-slate-300'
                  }
                >
                  {t.current_state}
                </span>
              </span>
            </div>
            {t.error && (
              <div className="text-[11px] text-red-300 mt-1 break-words">{t.error}</div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <>
      <dt className="text-[11px] uppercase tracking-wide text-slate-500 col-span-1 self-center">
        {label}
      </dt>
      <dd
        className={`col-span-2 ${small ? 'text-xs' : 'text-sm'} text-slate-100 break-words ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </dd>
    </>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      <ul className="space-y-1 text-xs font-mono">
        {items.map((it, i) => (
          <li
            key={`${label}-${i}`}
            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 break-words"
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
