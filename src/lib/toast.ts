import { useEffect, useState } from 'react';

export type ToastType = 'error' | 'success';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let seq = 0;
let toasts: ToastItem[] = [];
const listeners = new Set<(items: ToastItem[]) => void>();

function emit() {
  listeners.forEach((fn) => fn(toasts));
}

export function showToast(message: string, type: ToastType = 'error') {
  const item: ToastItem = { id: ++seq, message, type };
  toasts = [...toasts, item];
  emit();
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== item.id);
    emit();
  }, 4000);
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
