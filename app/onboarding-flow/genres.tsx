import { View, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { colors } from '../../src/constants/theme';
import { useOnboarding } from '../../src/contexts/onboarding-context';
import {
  ERA_BLOCKS,
  GENRE_BLOCKS,
  type CuratedFilm,
  type OnboardingBlock,
} from '../../src/data/onboardingCuration';
import { MosaicBlock } from '../../src/components/onboarding/MosaicBlock';
import { AccumulationStrip } from '../../src/components/onboarding/AccumulationStrip';
import { OnboardingHeader } from '../../src/components/onboarding/OnboardingHeader';
import { ContinueButton } from '../../src/components/onboarding/ContinueButton';

const GENRE_CAP = 5;
// Vertical space the absolute continue bar occupies above the safe-area inset.
// FlatList content reserves this much padding at the bottom so the last items
// scroll above the bar instead of being permanently hidden behind it.
const CONTINUE_BAR_HEIGHT = 90;

export default function GenresScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { eras, genres, setGenres } = useOnboarding();

  const atCap = genres.length >= GENRE_CAP;
  const isAtCapForBlock = (id: string) => atCap && !genres.includes(id);

  const handlePress = (blockId: string) => {
    const isSelected = genres.includes(blockId);
    if (isSelected) {
      setGenres(genres.filter((id) => id !== blockId));
      return;
    }
    if (atCap) return;
    setGenres([...genres, blockId]);
  };

  const handleContinue = () => {
    router.push('/onboarding-flow/films' as any);
  };

  const handleSkip = () => {
    setGenres([]);
    router.push('/onboarding-flow/films' as any);
  };

  const eraFilms: CuratedFilm[] = eras.flatMap((id) => {
    const block = ERA_BLOCKS.find((b) => b.id === id);
    return block ? [...block.films] : [];
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']}>
        <OnboardingHeader title="Pick your genres" onSkip={handleSkip} />
      </SafeAreaView>
      <AccumulationStrip films={eraFilms} label="Your eras" height="compact" />
      <FlatList
        style={{ flex: 1 }}
        data={GENRE_BLOCKS}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{
          gap: 12,
          paddingTop: 16,
          paddingBottom: CONTINUE_BAR_HEIGHT + insets.bottom,
        }}
        renderItem={({ item }: { item: OnboardingBlock }) => (
          <View style={{ flex: 1 }}>
            <MosaicBlock
              block={item}
              selected={genres.includes(item.id)}
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
            <ContinueButton visible={genres.length > 0} onPress={handleContinue} />
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
