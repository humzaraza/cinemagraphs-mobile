import { useEffect, useCallback } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});
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
    console.log('[Layout] isAuthenticated:', isAuthenticated, 'needsOnboarding:', needsOnboarding, 'isLoading:', isLoading);
    if (isLoading) return;
    if (isAuthenticated && needsOnboarding) {
      console.log('[Layout] Pushing to /onboarding');
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

  const onLayoutReady = useCallback(async () => {
    if (fontsLoaded) {
      try { await SplashScreen.hideAsync(); } catch {}
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#0D0D1A' }} />;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutReady}>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNav />
      </AuthProvider>
    </View>
  );
}
