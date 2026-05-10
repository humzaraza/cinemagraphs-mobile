import { useEffect } from 'react';
import { View, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { colors } from '../../src/constants/theme';
import { useOnboarding } from '../../src/contexts/onboarding-context';
import { ERA_BLOCKS, type OnboardingBlock } from '../../src/data/onboardingCuration';
import { MosaicBlock } from '../../src/components/onboarding/MosaicBlock';
import { OnboardingHeader } from '../../src/components/onboarding/OnboardingHeader';
import { ContinueButton } from '../../src/components/onboarding/ContinueButton';
import { trackEvent, EVENTS } from '../../src/lib/events';

const ERA_CAP = 4;
// Vertical space the absolute continue bar occupies above the safe-area inset.
// FlatList content reserves this much padding at the bottom so the last items
// scroll above the bar instead of being permanently hidden behind it.
const CONTINUE_BAR_HEIGHT = 90;

export default function ErasScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { eras, setEras } = useOnboarding();

  const HORIZONTAL_PADDING = 16;
  const COLUMN_GAP = 10;
  const NUM_COLUMNS = 2;
  const ITEM_WIDTH =
    (screenWidth - HORIZONTAL_PADDING * 2 - COLUMN_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  useEffect(() => {
    trackEvent(EVENTS.ONBOARDING_STEP_VIEW, { screen: 'eras' });
  }, []);

  const atCap = eras.length >= ERA_CAP;
  const isAtCapForBlock = (id: string) => atCap && !eras.includes(id);

  const handlePress = (blockId: string) => {
    const isSelected = eras.includes(blockId);
    if (isSelected) {
      setEras(eras.filter((id) => id !== blockId));
      return;
    }
    if (atCap) return;
    setEras([...eras, blockId]);
  };

  const handleContinue = () => {
    router.push('/onboarding/genres' as any);
  };

  const handleSkip = () => {
    trackEvent(EVENTS.ONBOARDING_SKIP, { screen: 'eras' });
    setEras([]);
    router.push('/onboarding/genres' as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']}>
        <OnboardingHeader
          title="Pick the eras you keep returning to"
          helper="We'll use these to find films you'll love."
          onSkip={handleSkip}
        />
      </SafeAreaView>
      <FlatList
        style={{ flex: 1 }}
        data={ERA_BLOCKS}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
        contentContainerStyle={{
          gap: 10,
          paddingTop: 16,
          paddingBottom: CONTINUE_BAR_HEIGHT + insets.bottom,
        }}
        renderItem={({ item }: { item: OnboardingBlock }) => (
          <View style={{ width: ITEM_WIDTH }}>
            <MosaicBlock
              block={item}
              selected={eras.includes(item.id)}
              atCap={isAtCapForBlock(item.id)}
              onPress={() => handlePress(item.id)}
            />
          </View>
        )}
      />
      <View pointerEvents="box-none" style={styles.continueBar}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(13,13,26,0)', colors.background]}
          locations={[0, 0.3]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView edges={['bottom']}>
          <View style={styles.continueBarInner}>
            <ContinueButton visible={eras.length > 0} onPress={handleContinue} />
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  continueBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  continueBarInner: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 22,
  },
});
