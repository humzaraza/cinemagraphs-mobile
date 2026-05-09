import { useEffect, useRef, useState } from 'react';
import { View, FlatList, StyleSheet, Pressable, Text, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { colors, fonts } from '../../src/constants/theme';
import { useOnboarding } from '../../src/contexts/onboarding-context';
import { ALL_BLOCKS, type CuratedFilm } from '../../src/data/onboardingCuration';
import { AccumulationStrip } from '../../src/components/onboarding/AccumulationStrip';
import { OnboardingHeader } from '../../src/components/onboarding/OnboardingHeader';
import { ContinueButton } from '../../src/components/onboarding/ContinueButton';
import { FilmPosterCard } from '../../src/components/onboarding/FilmPosterCard';
import { fetchScreen3Candidates, type Screen3Film } from '../../src/lib/onboarding-api';

const CONTINUE_BAR_HEIGHT = 90;
const NUM_COLUMNS = 3;
const COLUMN_GAP = 10;
const HORIZONTAL_PADDING = 16;
const SKELETON_COUNT = 18;

export default function FilmsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { eras, genres, filmIds, setFilmIds } = useOnboarding();

  const ITEM_WIDTH =
    (screenWidth - HORIZONTAL_PADDING * 2 - COLUMN_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const [films, setFilms] = useState<Screen3Film[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetchScreen3Candidates(eras, genres)
      .then((res) => {
        if (!isMountedRef.current) return;
        setFilms(res.films);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMountedRef.current) return;
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      });
  }, [eras, genres, retryToken]);

  const refetch = () => setRetryToken((t) => t + 1);

  const handleToggle = (filmId: string) => {
    if (filmIds.includes(filmId)) {
      setFilmIds(filmIds.filter((id) => id !== filmId));
    } else {
      setFilmIds([...filmIds, filmId]);
    }
  };

  const handleContinue = () => {
    router.push('/onboarding/reveal' as any);
  };

  const handleSkip = () => {
    setFilmIds([]);
    router.push('/onboarding/reveal' as any);
  };

  const tasteSoFarFilms: CuratedFilm[] = [...eras, ...genres].flatMap((id) => {
    const block = ALL_BLOCKS.find((b) => b.id === id);
    return block ? [...block.films] : [];
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']}>
        <OnboardingHeader
          title="Pick the films you love"
          helper="Anything that catches your eye. Skip if nothing fits."
          onBack={() => router.back()}
          onSkip={handleSkip}
        />
      </SafeAreaView>
      <AccumulationStrip
        films={tasteSoFarFilms}
        label="Your taste so far"
        height="tall"
      />

      {isLoading ? (
        <LoadingState itemWidth={ITEM_WIDTH} />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={films}
          numColumns={NUM_COLUMNS}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={{ gap: COLUMN_GAP, paddingHorizontal: HORIZONTAL_PADDING }}
          contentContainerStyle={{
            gap: COLUMN_GAP,
            paddingTop: 16,
            paddingBottom: CONTINUE_BAR_HEIGHT + insets.bottom,
          }}
          renderItem={({ item }: { item: Screen3Film }) => (
            <View style={{ width: ITEM_WIDTH }}>
              <FilmPosterCard
                film={item}
                selected={filmIds.includes(item.id)}
                onPress={() => handleToggle(item.id)}
              />
            </View>
          )}
        />
      )}

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
            <ContinueButton visible={filmIds.length > 0} onPress={handleContinue} />
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

function LoadingState({ itemWidth }: { itemWidth: number }) {
  const rows = Math.ceil(SKELETON_COUNT / NUM_COLUMNS);
  return (
    <View
      style={{
        flex: 1,
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 16,
      }}
    >
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <View
          key={rowIdx}
          style={{ flexDirection: 'row', gap: COLUMN_GAP, marginBottom: COLUMN_GAP }}
        >
          {Array.from({ length: NUM_COLUMNS }).map((_, colIdx) => {
            const linearIdx = rowIdx * NUM_COLUMNS + colIdx;
            if (linearIdx >= SKELETON_COUNT) {
              return <View key={colIdx} style={{ width: itemWidth }} />;
            }
            return (
              <View key={colIdx} style={{ width: itemWidth }}>
                <View style={styles.skeletonPoster} />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Could not load films.</Text>
      <Text style={styles.errorDetail}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryLabel}>Retry</Text>
      </Pressable>
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
  skeletonPoster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 6,
    backgroundColor: colors.cardBackground,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.ivory,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDetail: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ivory,
    opacity: 0.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: colors.gold,
    opacity: 0.7,
  },
  retryLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.background,
  },
});
