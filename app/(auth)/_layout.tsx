import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';

export default function AuthLayout() {
  const { isAuthenticated, needsOnboarding } = useAuth();
  if (isAuthenticated && needsOnboarding) return <Redirect href="/onboarding" />;
  if (isAuthenticated) return <Redirect href="/(tabs)/explore" />;
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: true }} />;
}
