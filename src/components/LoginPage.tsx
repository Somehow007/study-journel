import { FormEvent, useState } from 'react';
import { loginWithPassword } from '../lib/http';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      await loginWithPassword(username.trim(), password);
      window.location.assign('/journal/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: 'var(--paper)' }}>
      <form onSubmit={onSubmit} className="card w-full max-w-sm rounded-xl p-8">
        <h1 className="font-sans text-h1 text-[var(--ink)]">手帐</h1>
        <p className="mt-1 font-sans text-small text-[var(--ink-faint)]">使用管理员账号登录</p>

        {error && (
          <p className="mt-4 rounded-md px-3 py-2 font-sans text-small" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
            {error}
          </p>
        )}

        <label className="mt-6 block font-sans text-small text-[var(--ink-soft)]" htmlFor="journal-user">
          用户名
        </label>
        <input
          id="journal-user"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1.5 w-full rounded-md border px-3 py-2 font-sans text-body outline-none"
          style={{ borderColor: 'var(--keyline)', background: 'var(--card)', color: 'var(--ink)' }}
        />

        <label className="mt-4 block font-sans text-small text-[var(--ink-soft)]" htmlFor="journal-pass">
          密码
        </label>
        <input
          id="journal-pass"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-md border px-3 py-2 font-sans text-body outline-none"
          style={{ borderColor: 'var(--keyline)', background: 'var(--card)', color: 'var(--ink)' }}
        />

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-md py-2.5 font-sans text-small text-white disabled:opacity-50"
          style={{ background: 'var(--brand)' }}
        >
          {loading ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  );
}
