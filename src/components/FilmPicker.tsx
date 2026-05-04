import { useCallback, useEffect, useRef, useState } from 'react';
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
import { colors, fonts, borderRadius } from '../constants/theme';
import { searchFilms } from '../lib/api';
import { getPosterUrl } from '../lib/tmdb-image';
import BottomSheet from './BottomSheet';
import type { Film } from '../types/film';

type FilmPickerProps = {
  // Whether the picker is open. Parent controls visibility.
  visible: boolean;
  // Called when user dismisses the picker without selecting.
  onClose: () => void;
  // Called when user taps a film. Parent decides what to do (add
  // to list, toggle into a draft, etc.). Picker does NOT close
  // itself. Parent calls onClose if it wants to close after select.
  onSelect: (film: Film) => void;
  // Optional: only films that pass the filter are SHOWN. Used by
  // the add-to-existing-list picker to hide already-added films.
  filter?: (film: Film) => boolean;
  // Optional: when provided, films whose id is in this set render
  // with a checkmark. Used by the create-list picker for multi-
  // select state. Omit for single-select-and-go pickers.
  selectedIds?: ReadonlySet<string>;
  // Optional sheet title. Defaults to "Add film".
  title?: string;
};

export default function FilmPicker({
  visible,
  onClose,
  onSelect,
  filter,
  selectedIds,
  title = 'Add film',
}: FilmPickerProps) {
  const [input, setInput] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [results, setResults] = useState<Film[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reset internal state whenever the picker closes so the next
  // open starts fresh.
  useEffect(() => {
    if (visible) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    setInput('');
    setLastQuery('');
    setResults([]);
    setSearching(false);
    setHasSearched(false);
  }, [visible]);

  const doSearch = useCallback(async (term: string) => {
    if (abortRef.current) abortRef.current.abort();
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLastQuery(trimmed);
    setSearching(true);
    try {
      const films = await searchFilms(trimmed, ctrl.signal);
      if (!ctrl.signal.aborted) {
        setResults(films);
        setHasSearched(true);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setResults([]);
        setHasSearched(true);
      }
    } finally {
      if (!ctrl.signal.aborted) setSearching(false);
    }
  }, []);

  const onChangeText = useCallback(
    (text: string) => {
      setInput(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(text), 400);
    },
    [doSearch],
  );

  const visibleResults = filter ? results.filter(filter) : results;
  const inputTrimmed = input.trim();

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.searchBar}>
        <TextInput
          value={input}
          onChangeText={onChangeText}
          placeholder="Search for a film to add"
          placeholderTextColor="rgba(245,240,225,0.2)"
          style={styles.searchInput}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
      <View style={styles.body}>
        {inputTrimmed.length < 2 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>Search for a film to add</Text>
          </View>
        ) : searching ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : hasSearched && results.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>
              No films found for "{lastQuery}"
            </Text>
          </View>
        ) : hasSearched && visibleResults.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>No films available to add</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {visibleResults.map((film) => {
              const isSelected = selectedIds ? selectedIds.has(film.id) : false;
              const posterUri = getPosterUrl(film, 'thumbnail');
              const director = film.director ?? null;
              return (
                <Pressable
                  key={film.id}
                  onPress={() => onSelect(film)}
                  style={styles.row}
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
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {film.title}
                    </Text>
                    {film.year ? (
                      <Text style={styles.rowSubtitle}>{film.year}</Text>
                    ) : null}
                    {director ? (
                      <Text style={styles.rowSubtitle} numberOfLines={1}>
                        Dir. {director}
                      </Text>
                    ) : null}
                  </View>
                  {selectedIds ? (
                    <View
                      style={[styles.check, isSelected && styles.checkActive]}
                    >
                      {isSelected ? (
                        <Text style={styles.checkMark}>{'✓'}</Text>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: 360,
  },
  list: {
    flex: 1,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  poster: {
    width: 36,
    height: 54,
    borderRadius: 3,
    backgroundColor: 'rgba(30,30,60,0.6)',
  },
  posterFallback: {
    backgroundColor: 'rgba(30,30,60,0.6)',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ivory,
  },
  rowSubtitle: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(245,240,225,0.5)',
    marginTop: 1,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(245,240,225,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  checkMark: {
    fontSize: 11,
    color: colors.background,
    fontFamily: fonts.bodyMedium,
  },
});
