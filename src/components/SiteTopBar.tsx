import { useEffect, useState } from 'react';
import { getDisplayName } from '../lib/auth';

export default function SiteTopBar() {
  const [title, setTitle] = useState('MySite');
  const [username, setUsername] = useState<string | null>(() => getDisplayName());

  useEffect(() => {
    setUsername(getDisplayName());
    fetch('/v1/site/config')
      .then((r) => r.json())
      .then((payload: { data?: { title?: string } }) => {
        if (payload?.data?.title) setTitle(payload.data.title);
      })
      .catch(() => {
        /* keep default */
      });
  }, []);

  return (
    <header
      className="sticky top-0 z-40 flex h-11 items-center gap-3 border-b px-4 font-sans text-small"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--keyline)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        height: 'calc(44px + env(safe-area-inset-top, 0px))',
      }}
    >
      <a
        href="/"
        className="shrink-0 text-[var(--ink-soft)] transition-colors hover:text-[var(--brand)]"
      >
        ← 博客
      </a>
      <span className="min-w-0 truncate font-medium text-[var(--ink)]">{title}</span>
      <span className="shrink-0 text-[var(--ink-faint)]">/ 手帐</span>
      {username && (
        <span className="ml-auto hidden shrink-0 truncate text-[var(--ink-faint)] sm:inline">{username}</span>
      )}
    </header>
  );
}
