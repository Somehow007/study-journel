import { useEffect, useState } from 'react';

export type ToastType = 'error' | 'success';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  onRetry?: () => void;
}

let seq = 0;
let toasts: ToastItem[] = [];
const listeners = new Set<(items: ToastItem[]) => void>();

function emit() {
  listeners.forEach((fn) => fn(toasts));
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function showToast(
  message: string,
  type: ToastType = 'error',
  options?: { onRetry?: () => void },
) {
  const item: ToastItem = { id: ++seq, message, type, onRetry: options?.onRetry };
  toasts = [...toasts, item];
  emit();
  window.setTimeout(() => dismissToast(item.id), 4000);
}

export function useToasts(): ToastItem[] {
  const [items, setItems] = useState<ToastItem[]>(toasts);
  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);
  return items;
}
