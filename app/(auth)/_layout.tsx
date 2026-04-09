import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';

export default function AuthLayout() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Redirect href="/(tabs)/explore" />;
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: true }} />;
}
