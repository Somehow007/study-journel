import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

const EXIT_MS = 180;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SheetCloseContext = createContext<() => void>(() => {});

export function useSheetClose() {
  return useContext(SheetCloseContext);
}

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  as?: 'div' | 'form';
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  enableDrag?: boolean;
}

export default function Sheet({
  title,
  onClose,
  children,
  as = 'div',
  onSubmit,
  enableDrag = true,
}: SheetProps) {
  const [state, setState] = useState<'open' | 'closing'>('closing');
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [dragY, setDragY] = useState(0);
  const startY = useRef(0);
  const dragging = dragY > 0;

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setDragY(0);
    setState('closing');
    window.setTimeout(() => {
      onCloseRef.current();
      previousFocus.current?.focus?.();
    }, EXIT_MS);
  }, []);

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => setState('open'));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (state !== 'open') return;
    const panel = panelRef.current;
    if (!panel) return;
    const preferred = panel.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, select');
    const focusable = preferred ?? panel.querySelector<HTMLElement>(FOCUSABLE);
    focusable?.focus();
  }, [state]);

  useEffect(() => {
    if (state === 'closing') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const list = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
      );
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [requestClose, state]);

  const onTouchStart = (event: React.TouchEvent) => {
    if (!enableDrag) return;
    startY.current = event.touches[0].clientY;
  };
  const onTouchMove = (event: React.TouchEvent) => {
    if (!enableDrag) return;
    const dy = event.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 80) requestClose();
    else setDragY(0);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(event);
  };

  const inner = as === 'form' ? <form onSubmit={handleSubmit}>{children}</form> : children;

  const node = (
    <div className="journal-sheet fixed inset-0 z-[60] flex items-end justify-center md:items-center">
      <div
        className="journal-sheet-backdrop absolute inset-0 bg-black/40"
        data-state={state}
        onClick={requestClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="overlay journal-sheet-panel relative"
        data-state={state}
        data-dragging={dragging ? 'true' : undefined}
        style={dragY ? { transform: `translate3d(0, ${dragY}px, 0)` } : undefined}
      >
        <SheetCloseContext.Provider value={requestClose}>
          <div
            className="flex justify-center pt-2 md:hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <span className="h-1 w-10 rounded-full bg-[var(--keyline)]" />
          </div>
          {inner}
        </SheetCloseContext.Provider>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
