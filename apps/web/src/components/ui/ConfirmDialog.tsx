import { useEffect, useRef } from 'react';
import Sheet, { useSheetClose } from './Sheet';
import { Pressable } from './Pressable';
import { settleConfirm, useConfirmRequest } from '../../lib/confirm';

function ConfirmBody({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  onPick,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  onPick: (ok: boolean) => void;
}) {
  const close = useSheetClose();
  return (
    <div className="px-5 pb-2 pt-3 md:px-6 md:pb-6 md:pt-6">
      <h3 className="font-sans text-title text-[var(--ink)]">{title}</h3>
      <p className="mt-2 whitespace-pre-line font-sans text-small leading-relaxed text-[var(--ink-soft)]">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Pressable
          variant="pill"
          onClick={() => {
            onPick(false);
            close();
          }}
          className="rounded-full border border-[var(--keyline)] px-4 py-2 font-sans text-small text-[var(--ink-soft)]"
        >
          {cancelLabel}
        </Pressable>
        <Pressable
          variant="pill"
          onClick={() => {
            onPick(true);
            close();
          }}
          className="rounded-md px-5 py-2 font-sans text-small text-[var(--text-inverse)]"
          style={{ background: danger ? 'var(--danger)' : 'var(--brand)' }}
        >
          {confirmLabel}
        </Pressable>
      </div>
    </div>
  );
}

export default function ConfirmHost() {
  const req = useConfirmRequest();
  const resultRef = useRef(false);
  useEffect(() => {
    resultRef.current = false;
  }, [req?.id]);
  if (!req) return null;
  return (
    <Sheet key={req.id} title={req.title} onClose={() => settleConfirm(resultRef.current)} enableDrag={false}>
      <ConfirmBody
        title={req.title}
        message={req.message}
        confirmLabel={req.confirmLabel ?? '确定'}
        cancelLabel={req.cancelLabel ?? '取消'}
        danger={Boolean(req.danger)}
        onPick={(ok) => {
          resultRef.current = ok;
        }}
      />
    </Sheet>
  );
}
