import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors, fonts, borderRadius } from '../../constants/theme';
import { fetchUserFilms, type UserReviewedFilm } from '../../lib/api';
import { getPosterUrl } from '../../lib/tmdb-image';
import BottomSheet from '../BottomSheet';
import { useToast } from '../ui/Toast';

type FavoritePickerProps = {
  // Parent controls visibility.
  visible: boolean;
  // Called when the user dismisses without selecting.
  onClose: () => void;
  // Called when the user taps a reviewed film. The parent appends the
  // film and persists. Every tap is an append: there is no toggle, no
  // checkmark, and duplicates are allowed. The picker does not close
  // itself; the parent decides what to do after a selection.
  onSelect: (film: UserReviewedFilm) => void;
};

export default function FavoritePicker({
  visible,
  onClose,
  onSelect,
}: FavoritePickerProps) {
  const [films, setFilms] = useState<UserReviewedFilm[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const { showError } = useToast();

  // Fetch the caller's reviewed films once per open. Reset on close so
  // the next open starts fresh (and re-fetches in case reviews changed).
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setFilms([]);
      setLoaded(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchUserFilms('reviewed')
      .then((result) => {
        if (cancelled) return;
        setFilms(result as UserReviewedFilm[]);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setFilms([]);
        setLoaded(true);
        showError('Could not load your films. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, showError]);

  // Client-side title filter. These are the user's own reviewed films, so
  // there is no remote search; just narrow the already-fetched list.
  const trimmed = query.trim().toLowerCase();
  const visibleFilms = trimmed
    ? films.filter((f) => f.title.toLowerCase().includes(trimmed))
    : films;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Choose a favorite">
      <Text style={styles.subtitle}>From films you&apos;ve reviewed</Text>
      <View style={styles.searchBar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Filter your films"
          placeholderTextColor="rgba(245,240,225,0.2)"
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
      <View style={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : loaded && films.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>
              You haven&apos;t reviewed any films yet.
            </Text>
          </View>
        ) : visibleFilms.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>No films match &quot;{query.trim()}&quot;</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.grid}>
              {visibleFilms.map((film, i) => {
                const posterUri = getPosterUrl(film, 'card');
                return (
                  <Pressable
                    // Index-keyed because the same film may legitimately
                    // appear once in this list; ids are unique here, but the
                    // key stays stable across filtering either way.
                    key={`${film.id}-${i}`}
                    onPress={() => onSelect(film)}
                    style={styles.cell}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${film.title} to favorites`}
                  >
                    {posterUri ? (
                      <Image
                        source={{ uri: posterUri }}
                        style={styles.poster}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.poster, styles.posterFallback]} />
                    )}
                    <Text style={styles.cellTitle} numberOfLines={2}>
                      {film.title}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: 'rgba(245,240,225,0.4)',
    marginTop: -8,
    marginBottom: 12,
  },
  searchBar: {
    backgroundColor: 'rgba(245,240,225,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.15)',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ivory,
    padding: 0,
  },
  body: {
    marginTop: 12,
    minHeight: 240,
    maxHeight: 380,
  },
  list: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '31%',
  },
  poster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 6,
    backgroundColor: 'rgba(30,30,60,0.6)',
  },
  posterFallback: {
    backgroundColor: 'rgba(30,30,60,0.6)',
  },
  cellTitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.7)',
    marginTop: 5,
    lineHeight: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.35)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
