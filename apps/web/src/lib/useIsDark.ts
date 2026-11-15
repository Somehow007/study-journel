import { useEffect, useState } from 'react';

/**
 * 响应式深色模式感知：监听 <html> class 变化（.dark 由 AppContext 主题切换驱动）。
 * 不要用一次性的 classList.contains——那样不响应切换。
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(el.classList.contains('dark'));
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
