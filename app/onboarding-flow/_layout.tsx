import { Stack } from 'expo-router';

import { OnboardingProvider } from '../../src/contexts/onboarding-context';
import { colors } from '../../src/constants/theme';

export default function OnboardingFlowLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </OnboardingProvider>
  );
}
