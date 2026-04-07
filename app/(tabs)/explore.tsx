import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing, borderRadius } from '../../src/constants/theme';
import { Film } from '../../src/types/film';

// Placeholder data until API integration
const PLACEHOLDER_FILMS: Film[] = [
  { id: '1', title: 'Loading...', posterPath: '', releaseDate: '', overallScore: 0 },
];

function FilmPoster({ film, size = 'medium' }: { film: Film; size?: 'small' | 'medium' | 'large' }) {
  const router = useRouter();
  const width = size === 'large' ? 160 : size === 'medium' ? 130 : 100;
  const height = width * 1.5;

  return (
    <Pressable
      onPress={() => router.push(`/film/${film.id}`)}
      style={({ pressed }) => [
        styles.posterContainer,
        { width, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {film.posterPath ? (
        <Image
          source={{ uri: film.posterPath }}
          style={[styles.posterImage, { width, height }]}
        />
      ) : (
        <View style={[styles.posterPlaceholder, { width, height }]}>
          <Text style={styles.posterPlaceholderText}>{film.title}</Text>
        </View>
      )}
      <Text style={styles.posterTitle} numberOfLines={1}>
        {film.title}
      </Text>
    </Pressable>
  );
}

function TrendingArcCard({ film }: { film: Film }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/film/${film.id}`)}
      style={({ pressed }) => [
        styles.trendingCard,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.trendingCardContent}>
        {film.posterPath ? (
          <Image
            source={{ uri: film.posterPath }}
            style={styles.trendingPoster}
          />
        ) : (
          <View style={[styles.posterPlaceholder, styles.trendingPoster]}>
            <Text style={styles.posterPlaceholderText}>{film.title}</Text>
          </View>
        )}
        <View style={styles.trendingInfo}>
          <Text style={styles.trendingTitle} numberOfLines={1}>
            {film.title}
          </Text>
          <Text style={styles.trendingScore}>
            {film.overallScore > 0 ? `${film.overallScore}%` : '--'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function ExploreScreen() {
  // TODO: Replace with real data from API calls
  const nowPlaying = PLACEHOLDER_FILMS;
  const trending = PLACEHOLDER_FILMS;
  const recommended = PLACEHOLDER_FILMS;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.screenTitle}>Explore</Text>

      {/* Now Playing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Now Playing</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {nowPlaying.map((film) => (
            <FilmPoster key={film.id} film={film} size="medium" />
          ))}
        </ScrollView>
      </View>

      {/* Trending Arcs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trending Arcs</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {trending.map((film) => (
            <TrendingArcCard key={film.id} film={film} />
          ))}
        </ScrollView>
      </View>

      {/* Recommended for You */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recommended for You</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {recommended.map((film) => (
            <FilmPoster key={film.id} film={film} size="medium" />
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingTop: 60,
    paddingBottom: 100,
  },
  screenTitle: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.ivory,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontFamily: fonts.headingBold,
    fontSize: 18,
    color: colors.ivory,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  horizontalList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  posterContainer: {
    marginRight: 0,
  },
  posterImage: {
    borderRadius: borderRadius.md,
    backgroundColor: colors.cardBackground,
  },
  posterPlaceholder: {
    borderRadius: borderRadius.md,
    backgroundColor: colors.cardBackground,
    borderWidth: 0.5,
    borderColor: colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
  },
  posterPlaceholderText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  posterTitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  trendingCard: {
    width: 220,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    borderWidth: 0.5,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  trendingCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
  },
  trendingPoster: {
    width: 50,
    height: 75,
    borderRadius: borderRadius.sm,
  },
  trendingInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  trendingTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ivory,
  },
  trendingScore: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.gold,
    marginTop: spacing.xs,
  },
});
