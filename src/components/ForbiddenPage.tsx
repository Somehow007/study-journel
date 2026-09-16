export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: 'var(--paper)' }}>
      <div className="card max-w-md rounded-xl p-8 text-center">
        <p className="font-mono text-caption text-[var(--ink-faint)]">403</p>
        <h1 className="mt-2 font-sans text-h1 text-[var(--ink)]">没有权限</h1>
        <p className="mt-3 font-sans text-body text-[var(--ink-soft)]">
          学习手帐仅管理员可访问。请使用管理员账号登录后再试。
        </p>
        <a
          href={typeof window !== 'undefined' && (window.location.port === '5174' || window.location.port === '5175')
            ? `${window.location.protocol}//${window.location.hostname}:5173/`
            : '/'}
          className="mt-6 inline-block rounded-md px-5 py-2 font-sans text-small text-white"
          style={{ background: 'var(--brand)' }}
        >
          返回博客
        </a>
      </div>
    </div>
  );
}
