import { Redirect } from 'expo-router';
import { useAuth } from '../src/providers/AuthProvider';

export default function Index() {
  const { isAuthenticated, isLoading, needsOnboarding } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated && needsOnboarding) return <Redirect href="/onboarding" />;
  if (isAuthenticated) return <Redirect href="/(tabs)/explore" />;
  return <Redirect href="/(auth)/landing" />;
}
