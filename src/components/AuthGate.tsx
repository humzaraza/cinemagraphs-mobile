import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../constants/theme';
import BottomSheet from './BottomSheet';
import { useAuth } from '../providers/AuthProvider';

interface AuthGateProps {
  children: React.ReactNode;
  onAuthenticated: () => void;
}

export default function AuthGate({ children, onAuthenticated }: AuthGateProps) {
  const { isAuthenticated } = useAuth();
  const [showSheet, setShowSheet] = useState(false);
  const router = useRouter();

  const handlePress = () => {
    if (isAuthenticated) {
      onAuthenticated();
    } else {
      setShowSheet(true);
    }
  };

  return (
    <>
      <Pressable onPress={handlePress}>{children}</Pressable>
      <BottomSheet
        visible={showSheet}
        onClose={() => setShowSheet(false)}
        title="Sign in to continue"
      >
        <Text style={styles.message}>
          You need an account to use this feature.
        </Text>
        <Pressable
          onPress={() => {
            setShowSheet(false);
            router.push('/(auth)/landing' as any);
          }}
          style={styles.signInBtn}
        >
          <Text style={styles.signInText}>Sign in</Text>
        </Pressable>
        <Pressable onPress={() => setShowSheet(false)} style={styles.notNowBtn}>
          <Text style={styles.notNowText}>Not now</Text>
        </Pressable>
      </BottomSheet>
    </>
  );
}

export function useAuthGate() {
  const { isAuthenticated } = useAuth();
  const [showSheet, setShowSheet] = useState(false);
  const router = useRouter();

  const gate = (action: () => void) => {
    if (isAuthenticated) {
      action();
    } else {
      setShowSheet(true);
    }
  };

  const sheet = (
    <BottomSheet
      visible={showSheet}
      onClose={() => setShowSheet(false)}
      title="Sign in to continue"
    >
      <Text style={styles.message}>
        You need an account to use this feature.
      </Text>
      <Pressable
        onPress={() => {
          setShowSheet(false);
          router.push('/(auth)/landing' as any);
        }}
        style={styles.signInBtn}
      >
        <Text style={styles.signInText}>Sign in</Text>
      </Pressable>
      <Pressable onPress={() => setShowSheet(false)} style={styles.notNowBtn}>
        <Text style={styles.notNowText}>Not now</Text>
      </Pressable>
    </BottomSheet>
  );

  return { gate, sheet };
}

const styles = StyleSheet.create({
  message: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.5)',
    textAlign: 'center',
    marginBottom: 16,
  },
  signInBtn: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  signInText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.background,
  },
  notNowBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  notNowText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.35)',
  },
});
