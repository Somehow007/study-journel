import { FormEvent, useState } from 'react';
import { login } from '../lib/auth';

const year = new Date().getFullYear();

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('请输入账号和口令');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      // 整页刷新：App 重新走 /auth/me 判定，QueryClient 缓存一并重建
      window.location.assign(import.meta.env.BASE_URL || '/journal/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="nb-login-desk">
      <div className="nb-login-book">
        <form onSubmit={onSubmit} className="nb-login-sheet">
          <div className="nb-login-title">
            <b>考研手记</b>
            <span>
              STUDY LOG · {year}—{year + 1}
            </span>
          </div>

          {error && <p className="nb-login-error">{error}</p>}

          <label className="nb-flab" htmlFor="journal-user">
            账号
          </label>
          <input
            id="journal-user"
            className="nb-field"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label className="nb-flab" htmlFor="journal-pass">
            口令
          </label>
          <input
            id="journal-pass"
            className="nb-field"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit" className="nb-btn p nb-login-submit" disabled={loading}>
            {loading ? '翻开中…' : '翻开'}
          </button>
          <p className="nb-login-foot">手帐仅本人使用</p>
        </form>
        <span className="nb-login-stamp">考研</span>
      </div>
    </div>
  );
}
