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

function RootNav() {
  const { isAuthenticated, isLoading, needsOnboarding } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && needsOnboarding) {
      router.push('/onboarding' as any);
    }
  }, [isAuthenticated, isLoading, needsOnboarding]);

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: '#0D0D1A' }} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="list" />
      <Stack.Screen name="graph" />
      <Stack.Screen name="live-react" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="index" />
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
      <RootNav />
    </AuthProvider>
  );
}
