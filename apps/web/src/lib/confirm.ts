import { useEffect, useState } from 'react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ConfirmRequest extends ConfirmOptions {
  id: number;
  resolve: (ok: boolean) => void;
}

let seq = 0;
let pending: ConfirmRequest | null = null;
const listeners = new Set<(req: ConfirmRequest | null) => void>();

function emit() {
  listeners.forEach((fn) => fn(pending));
}

export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (pending) pending.resolve(false);
    pending = { ...options, id: ++seq, resolve };
    emit();
  });
}

export function settleConfirm(ok: boolean) {
  if (!pending) return;
  pending.resolve(ok);
  pending = null;
  emit();
}

export function useConfirmRequest(): ConfirmRequest | null {
  const [req, setReq] = useState<ConfirmRequest | null>(pending);
  useEffect(() => {
    listeners.add(setReq);
    return () => {
      listeners.delete(setReq);
    };
  }, []);
  return req;
}
