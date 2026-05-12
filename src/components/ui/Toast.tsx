import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo } from 'react-native';

import { ToastView, type ToastVariant } from './ToastView';

interface ToastState {
  id: number;
  variant: ToastVariant;
  message: string;
  duration: number;
}

interface ShowOptions {
  duration?: number;
}

interface ToastContextValue {
  showError: (message: string, options?: ShowOptions) => number;
  showSuccess: (message: string, options?: ShowOptions) => number;
  dismiss: (id: number) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue>({
  showError: () => -1,
  showSuccess: () => -1,
  dismiss: () => {},
  dismissAll: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const DEFAULT_DURATION_MS = 4000;
const MAX_QUEUE = 3;
const GAP_MS = 100;

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ToastState[]>([]);
  const [exitingId, setExitingId] = useState<number | null>(null);
  const [gapping, setGapping] = useState(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleToast = queue[0] ?? null;
  const isExiting = visibleToast != null && exitingId === visibleToast.id;

  const show = useCallback(
    (variant: ToastVariant, message: string, options?: ShowOptions): number => {
      const id = ++nextId;
      const duration = options?.duration ?? DEFAULT_DURATION_MS;
      setQueue((q) => {
        const withNew = [...q, { id, variant, message, duration }];
        if (withNew.length > MAX_QUEUE) {
          return [withNew[0], ...withNew.slice(2)];
        }
        return withNew;
      });
      AccessibilityInfo.announceForAccessibility(message);
      return id;
    },
    [],
  );

  const showError = useCallback(
    (m: string, o?: ShowOptions) => show('error', m, o),
    [show],
  );
  const showSuccess = useCallback(
    (m: string, o?: ShowOptions) => show('success', m, o),
    [show],
  );

  const dismiss = useCallback((id: number) => {
    setQueue((q) => {
      if (q[0]?.id === id) {
        setExitingId(id);
        return q;
      }
      return q.filter((t) => t.id !== id);
    });
  }, []);

  const dismissAll = useCallback(() => {
    setQueue((q) => {
      if (q[0]) {
        setExitingId(q[0].id);
        return [q[0]];
      }
      return [];
    });
  }, []);

  // Auto-dismiss timer for the visible (not-exiting) toast. Skipped when
  // duration is 0 (manual-only) or the queue is mid-gap.
  useEffect(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    if (!visibleToast || gapping || isExiting) return;
    if (visibleToast.duration === 0) return;
    autoTimer.current = setTimeout(() => {
      setExitingId(visibleToast.id);
    }, visibleToast.duration);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  }, [visibleToast?.id, visibleToast?.duration, gapping, isExiting]);

  useEffect(
    () => () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      if (gapTimer.current) clearTimeout(gapTimer.current);
    },
    [],
  );

  const handleExitComplete = useCallback(() => {
    setExitingId(null);
    setQueue((q) => q.slice(1));
    setGapping(true);
    if (gapTimer.current) clearTimeout(gapTimer.current);
    gapTimer.current = setTimeout(() => setGapping(false), GAP_MS);
  }, []);

  return (
    <ToastContext.Provider
      value={{ showError, showSuccess, dismiss, dismissAll }}
    >
      {children}
      {visibleToast && !gapping && (
        <ToastView
          key={visibleToast.id}
          variant={visibleToast.variant}
          message={visibleToast.message}
          exiting={isExiting}
          onDismiss={() => dismiss(visibleToast.id)}
          onExitComplete={handleExitComplete}
        />
      )}
    </ToastContext.Provider>
  );
}
