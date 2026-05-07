import { View, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../src/constants/theme';
import { useOnboarding } from '../../src/contexts/onboarding-context';
import {
  ERA_BLOCKS,
  type CuratedFilm,
  type OnboardingBlock,
} from '../../src/data/onboardingCuration';
import { MosaicBlock } from '../../src/components/onboarding/MosaicBlock';
import { AccumulationStrip } from '../../src/components/onboarding/AccumulationStrip';
import { OnboardingHeader } from '../../src/components/onboarding/OnboardingHeader';
import { ContinueButton } from '../../src/components/onboarding/ContinueButton';

const ERA_CAP = 4;

export default function ErasScreen() {
  const { eras, setEras } = useOnboarding();

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
    console.log('[onboarding/eras] continue', { eras });
    // TODO Chunk 4: navigate to /onboarding-flow/genres
  };

  const handleSkip = () => {
    setEras([]);
    console.log('[onboarding/eras] skip');
    // TODO Chunk 4: navigate to /onboarding-flow/genres with empty eras
  };

  const selectedFilms: CuratedFilm[] = eras.flatMap((id) => {
    const block = ERA_BLOCKS.find((b) => b.id === id);
    return block ? [...block.films] : [];
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']}>
        <OnboardingHeader
          title="Pick the eras you keep returning to"
          onSkip={handleSkip}
        />
      </SafeAreaView>
      <FlatList
        style={{ flex: 1 }}
        data={ERA_BLOCKS}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingVertical: 16 }}
        renderItem={({ item }: { item: OnboardingBlock }) => (
          <View style={{ flex: 1 }}>
            <MosaicBlock
              block={item}
              selected={eras.includes(item.id)}
              atCap={isAtCapForBlock(item.id)}
              onPress={() => handlePress(item.id)}
            />
          </View>
        )}
      />
      <SafeAreaView edges={['bottom']}>
        <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 12 }}>
          <AccumulationStrip films={selectedFilms} label="Your eras" height="compact" />
          <ContinueButton visible={eras.length > 0} onPress={handleContinue} />
        </View>
      </SafeAreaView>
    </View>
  );
}
