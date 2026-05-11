import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '../../constants/theme';

type ToastVariant = 'error' | 'success';

interface ToastState {
  variant: ToastVariant;
  message: string;
}

interface ToastContextValue {
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showError: () => {},
  showSuccess: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setToast(null);
  }, []);

  const show = useCallback((variant: ToastVariant, message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ variant, message });
    AccessibilityInfo.announceForAccessibility(message);
    timer.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
  }, []);

  const showError = useCallback((m: string) => show('error', m), [show]);
  const showSuccess = useCallback((m: string) => show('success', m), [show]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showError, showSuccess }}>
      {children}
      {toast && <ToastView toast={toast} onDismiss={dismiss} />}
    </ToastContext.Provider>
  );
}

function ToastView({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isError = toast.variant === 'error';
  return (
    <Pressable
      accessibilityRole="alert"
      accessibilityLabel={toast.message}
      onPress={onDismiss}
      style={[
        styles.toast,
        {
          top: insets.top + 8,
          backgroundColor: isError ? '#E05555' : '#2DD4A8',
        },
      ]}
    >
      <Text style={[styles.text, { color: isError ? '#F5F0E1' : '#0D0D1A' }]}>
        {toast.message}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    zIndex: 1000,
  },
  text: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
});
