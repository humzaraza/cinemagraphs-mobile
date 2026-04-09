import { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import AuthProvider, { useAuth } from '../src/providers/AuthProvider';

export { ErrorBoundary } from 'expo-router';

function AuthGatedLayout() {
  const { isAuthenticated, isLoading, needsOnboarding, clearOnboarding } = useAuth();
  const router = useRouter();

  // One-time onboarding redirect after first sign-in
  useEffect(() => {
    if (isAuthenticated && needsOnboarding) {
      clearOnboarding();
      router.push('/settings/about' as any);
    }
  }, [isAuthenticated, needsOnboarding]);

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: '#0D0D1A' }} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="list" />
          <Stack.Screen name="graph" />
          <Stack.Screen name="live-react" />
        </>
      ) : (
        <Stack.Screen name="(auth)" />
      )}
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#0D0D1A' }} />;
  }

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AuthGatedLayout />
    </AuthProvider>
  );
}
