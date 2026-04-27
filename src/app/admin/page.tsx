'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/components/providers/SessionProvider';
import { Loader2Icon } from 'lucide-react';

interface UserRow {
  login: string;
  role: 'admin' | 'viewer';
  totp_enabled: number;
  created_at: number;
  last_login_at: number;
}

interface UsersResponse {
  users: UserRow[];
  seat_limit: number;
  seats_used: number;
}

const RELATIVE = (ts: number) => {
  if (!ts) return 'never';
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86_400) return `${Math.floor(delta / 3_600)}h ago`;
  return `${Math.floor(delta / 86_400)}d ago`;
};

/**
 * /admin — promote/demote, remove seats, see seat-cap headroom.
 *
 * Admin-only. Viewers landing here see a stub with a "go back" link;
 * the API will 403 them anyway.
 */
export default function AdminPage() {
  const router = useRouter();
  const { user: currentUser, role, status } = useSession();
  const [data, setData] = useState<UsersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/users', { credentials: 'same-origin' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.status === 403) {
        setError('admin access required');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as UsersResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    }
  }, []);

  useEffect(() => {
    if (status === 'guest') router.replace('/login');
    if (status === 'pending_mfa') router.replace('/mfa');
  }, [status, router]);

  useEffect(() => {
    if (status === 'authed') fetchUsers();
  }, [status, fetchUsers]);

  const setRole = useCallback(
    async (login: string, newRole: 'admin' | 'viewer') => {
      setPending(login);
      setError(null);
      try {
        const res = await apiFetch(`/api/users/${encodeURIComponent(login)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => 'failed');
          throw new Error(t || `HTTP ${res.status}`);
        }
        await fetchUsers();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'failed');
      } finally {
        setPending(null);
      }
    },
    [fetchUsers],
  );

  const removeUser = useCallback(
    async (login: string) => {
      if (!confirm(`Remove seat for ${login}? They can sign in again if a seat is free.`)) {
        return;
      }
      setPending(login);
      setError(null);
      try {
        const res = await apiFetch(`/api/users/${encodeURIComponent(login)}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const t = await res.text().catch(() => 'failed');
          throw new Error(t || `HTTP ${res.status}`);
        }
        await fetchUsers();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'failed');
      } finally {
        setPending(null);
      }
    },
    [fetchUsers],
  );

  if (status !== 'authed') {
    return (
      <div className="center-screen">
        <Loader2Icon className="w-6 h-6 animate-spin" style={{ color: 'var(--fg-2)' }} />
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div className="center-screen" style={{ flexDirection: 'column', gap: 12 }}>
        <div className="mono" style={{ color: 'var(--err)' }}>
          /admin requires the admin role.
        </div>
        <button className="btn" onClick={() => router.push('/')}>
          ← back to dashboard
        </button>
      </div>
    );
  }

  const seats = data
    ? `${data.seats_used} / ${data.seat_limit}`
    : '— / —';
  const seatsFull = data ? data.seats_used >= data.seat_limit : false;

  return (
    <div className="app-shell" style={{ gridTemplateColumns: '1fr' }}>
      <main className="main">
        <div className="topbar">
          <div className="breadcrumb">
            <span className="prompt">$</span>
            <button
              type="button"
              className="nav-item"
              onClick={() => router.push('/')}
              style={{ height: 'auto', padding: '0 4px', display: 'inline-flex' }}
            >
              ←&nbsp;back
            </button>
            <span className="sep">/</span>
            <span className="here">admin</span>
          </div>
          <div className="topbar-actions">
            <button className="btn" onClick={fetchUsers} title="Refresh">
              ↻ refresh
            </button>
          </div>
        </div>

        <div className="scroll">
          <div className="pane">
            {error && (
              <div className="panel" style={{ borderColor: 'var(--err-bd)' }}>
                <div className="panel-body" style={{ color: 'var(--err)' }}>
                  {error}
                </div>
              </div>
            )}

            <div className="panel">
              <div className="panel-head">
                <div className="panel-title">
                  <span className="ico">⌬</span> SEATS
                  <span
                    className="meta"
                    style={{ color: seatsFull ? 'var(--warn)' : 'var(--fg-2)' }}
                  >
                    {seats} {seatsFull ? '· cap reached' : ''}
                  </span>
                </div>
              </div>
              <div className="panel-body" style={{ padding: 16 }}>
                <div
                  className="mono muted"
                  style={{ fontSize: 12, lineHeight: 1.6 }}
                >
                  Community Edition is capped at {data?.seat_limit ?? 3}{' '}
                  active seats. New sign-ins past the cap are rejected at
                  the OAuth callback. Remove a seat below to make room.
                  Existing users keep their access regardless of the cap.
                </div>
              </div>
            </div>

            <div className="panel" style={{ marginTop: 12 }}>
              <div className="panel-head">
                <div className="panel-title">
                  <span className="ico">≡</span> USERS
                </div>
              </div>
              <div className="panel-body flush">
                {data === null ? (
                  <div className="empty">
                    <Loader2Icon className="w-5 h-5 animate-spin" />
                  </div>
                ) : data.users.length === 0 ? (
                  <div className="empty">No users yet.</div>
                ) : (
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>LOGIN</th>
                        <th style={{ width: 100 }}>ROLE</th>
                        <th style={{ width: 80 }}>2FA</th>
                        <th style={{ width: 110 }}>LAST SIGN-IN</th>
                        <th style={{ width: 280 }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.map((u) => {
                        const isSelf = u.login === currentUser;
                        const isPending = pending === u.login;
                        return (
                          <tr key={u.login}>
                            <td className="mono" style={{ color: 'var(--fg)' }}>
                              {u.login}
                              {isSelf ? <span className="muted"> (you)</span> : null}
                            </td>
                            <td
                              className="mono"
                              style={{
                                color:
                                  u.role === 'admin' ? 'var(--accent)' : 'var(--fg-2)',
                              }}
                            >
                              {u.role}
                            </td>
                            <td className="mono">
                              {u.totp_enabled ? '✓' : '—'}
                            </td>
                            <td className="mono muted">
                              {RELATIVE(u.last_login_at)}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {u.role === 'viewer' ? (
                                  <button
                                    className="btn"
                                    disabled={isPending}
                                    onClick={() => setRole(u.login, 'admin')}
                                  >
                                    {isPending ? '…' : 'promote → admin'}
                                  </button>
                                ) : (
                                  <button
                                    className="btn"
                                    disabled={isPending}
                                    onClick={() => setRole(u.login, 'viewer')}
                                  >
                                    {isPending ? '…' : 'demote → viewer'}
                                  </button>
                                )}
                                <button
                                  className="btn"
                                  style={{
                                    borderColor: 'var(--err-bd)',
                                    color: 'var(--err)',
                                  }}
                                  disabled={isPending || isSelf}
                                  onClick={() => removeUser(u.login)}
                                  title={
                                    isSelf
                                      ? "you can't remove your own seat"
                                      : 'remove seat'
                                  }
                                >
                                  remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
