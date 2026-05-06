import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Alert,
  BackHandler,
  TextInput,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts } from '../src/constants/theme';
import BannerGradient from '../src/components/BannerGradient';
import {
  BANNER_PRESET_KEYS,
  getBannerPreset,
  isBannerPresetKey,
  type BannerPresetKey,
} from '../src/constants/bannerPresets';
import {
  fetchBackdropFilms,
  fetchFilmDetail,
  updateUserBanner,
  type BannerType,
} from '../src/lib/api';
import {
  getInitialState,
  getResetStateForTab,
  getStateAfterFilmSelection,
  isSaveEnabled,
  type PickerState,
  type PickerTab,
} from '../src/lib/banner-picker';
import { resolveBannerSource } from '../src/lib/banner-url';
import { getPosterUrl } from '../src/lib/tmdb-image';
import type { Film, FilmDetail } from '../src/types/film';

const SWATCH_PAD = 20;
const SWATCH_GAP = 16;
const RING_PAD = 3;
const BANNER_RATIO = 393 / 180; // legacy gradient swatch ratio (preserved)
const SEARCH_DEBOUNCE_MS = 300;

const POSTER_PAD = 16;
const POSTER_GAP = 8;
const POSTER_COLS = 3;

const PICKER_TABS: { key: PickerTab; label: string }[] = [
  { key: 'GRADIENT', label: 'Gradient' },
  { key: 'BACKDROP', label: 'Backdrop' },
  { key: 'PHOTO', label: 'Photo' },
];

// Route params come in as strings. Coerce bannerType to a known value or
// fall back to GRADIENT (the only persisted type before PR 1b).
function parseBannerType(raw: string | string[] | undefined): BannerType {
  if (raw === 'BACKDROP' || raw === 'PHOTO' || raw === 'GRADIENT') return raw;
  return 'GRADIENT';
}

function parseBannerValue(raw: string | string[] | undefined): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return '';
}

export default function HeaderPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { bannerType: rawType, bannerValue: rawValue } = useLocalSearchParams<{
    bannerType?: string;
    bannerValue?: string;
  }>();

  // Anchor persisted state at mount in a ref so the dirty check stays
  // pinned to the value the user opened the picker with. The Profile
  // screen pushes both bannerType and bannerValue into the route params
  // (PR 1b); legacy callers that only passed `current` still resolve to
  // GRADIENT thanks to parseBannerType's fallback.
  const persisted = useRef({
    bannerType: parseBannerType(rawType),
    bannerValue: parseBannerValue(rawValue),
  }).current;

  const [state, setState] = useState<PickerState>(() => getInitialState(persisted));
  const [saving, setSaving] = useState(false);

  // Persisted backdrop film (only relevant when persisted.bannerType is
  // BACKDROP). Fetched once at mount to drive the preview when no draft
  // selection has been made yet, and to highlight the saved film if it
  // appears in the Popular slice.
  const [persistedFilm, setPersistedFilm] = useState<FilmDetail | null>(null);

  // Backdrop mode state
  const [popularFilms, setPopularFilms] = useState<Film[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Film[]>([]);
  const [filmsLoading, setFilmsLoading] = useState(false);
  const [filmsError, setFilmsError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const popularLoadedRef = useRef(false);

  const saveEnabled = isSaveEnabled(state, persisted, state.activeTab);

  // -------------------------------------------------------------------------
  // Persisted backdrop film fetch (mount-only when persisted is BACKDROP)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (persisted.bannerType !== 'BACKDROP' || !persisted.bannerValue) return;
    let cancelled = false;
    fetchFilmDetail(persisted.bannerValue)
      .then((film) => {
        if (!cancelled) setPersistedFilm(film);
      })
      .catch(() => {
        // Swallow; preview falls back to default gradient via resolveBannerSource.
      });
    return () => {
      cancelled = true;
    };
  }, [persisted.bannerType, persisted.bannerValue]);

  // -------------------------------------------------------------------------
  // Popular films cache (load once when BACKDROP tab is first activated)
  // -------------------------------------------------------------------------
  const loadPopular = useCallback(async () => {
    if (popularLoadedRef.current) return;
    popularLoadedRef.current = true;
    setFilmsLoading(true);
    setFilmsError(false);
    try {
      const films = await fetchBackdropFilms({ limit: 12 });
      setPopularFilms(films);
    } catch {
      setFilmsError(true);
      // Allow a retry on next activation
      popularLoadedRef.current = false;
    } finally {
      setFilmsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (state.activeTab !== 'BACKDROP') return;
    loadPopular();
  }, [state.activeTab, loadPopular]);

  // -------------------------------------------------------------------------
  // Search (debounced 300ms after the last keystroke)
  // -------------------------------------------------------------------------
  const runSearch = useCallback(async (term: string) => {
    if (abortRef.current) abortRef.current.abort();
    const trimmed = term.trim();
    if (!trimmed) {
      setSearchResults([]);
      setFilmsError(false);
      setFilmsLoading(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setFilmsLoading(true);
    setFilmsError(false);
    try {
      const films = await fetchBackdropFilms({
        q: trimmed,
        limit: 12,
        signal: ctrl.signal,
      });
      if (!ctrl.signal.aborted) {
        setSearchResults(films);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setSearchResults([]);
        setFilmsError(true);
      }
    } finally {
      if (!ctrl.signal.aborted) setFilmsLoading(false);
    }
  }, []);

  const onSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runSearch(text), SEARCH_DEBOUNCE_MS);
    },
    [runSearch],
  );

  // Cleanup pending debounce / abort on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // -------------------------------------------------------------------------
  // Hardware back
  // -------------------------------------------------------------------------
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [router]);

  // -------------------------------------------------------------------------
  // Tab switch
  // -------------------------------------------------------------------------
  const onTabChange = useCallback(
    (tab: PickerTab) => {
      if (tab === state.activeTab) return;
      setState(getResetStateForTab(tab, persisted));
      // Clear any pending search work so we don't apply stale results
      // to the BACKDROP tab on a tab toggle.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
      setSearchQuery('');
      setSearchResults([]);
      setFilmsError(false);
    },
    [persisted, state.activeTab],
  );

  // -------------------------------------------------------------------------
  // Film selection (BACKDROP)
  // -------------------------------------------------------------------------
  const onSelectFilm = useCallback((film: Film) => {
    setState((prev) => getStateAfterFilmSelection(prev, film));
  }, []);

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------
  const handleSave = async () => {
    if (!saveEnabled || saving) return;
    setSaving(true);
    try {
      await updateUserBanner(state.bannerType, state.bannerValue);
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save banner';
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Preview source
  // -------------------------------------------------------------------------
  // The preview reflects the current draft. For BACKDROP, prefer the just-
  // selected film, then fall back to the persisted film record (when the
  // draft equals persisted, e.g. immediately after mount or a tab reset).
  const previewSource = useMemo(() => {
    let film: Film | null = state.selectedFilm;
    if (
      !film &&
      state.bannerType === 'BACKDROP' &&
      state.bannerValue === persisted.bannerValue &&
      persistedFilm
    ) {
      film = persistedFilm;
    }
    return resolveBannerSource(state.bannerType, state.bannerValue, film);
  }, [state, persisted.bannerValue, persistedFilm]);

  const previewWidth = screenWidth - SWATCH_PAD * 2;
  const previewHeight = (previewWidth * 9) / 16;

  const swatchOuterWidth = (screenWidth - SWATCH_PAD * 2 - SWATCH_GAP) / 2;
  const swatchOuterHeight = swatchOuterWidth / BANNER_RATIO;

  // Active film list for BACKDROP. Empty query -> popular cache, else search.
  const activeFilms = searchQuery.trim() ? searchResults : popularFilms;
  const sectionHeader = searchQuery.trim() ? 'Results' : 'Popular films';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={styles.backBtn}
        >
          <Text style={styles.backChevron}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Banner style</Text>
        <Pressable
          onPress={handleSave}
          disabled={!saveEnabled || saving}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Save banner"
          accessibilityState={{ disabled: !saveEnabled || saving }}
          style={styles.saveBtn}
        >
          <Text
            style={[
              styles.saveText,
              (!saveEnabled || saving) && styles.saveTextDisabled,
            ]}
          >
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---- Preview (16:9 WYSIWYG) ---- */}
        <View style={styles.previewWrap}>
          <Text style={styles.previewLabel}>PREVIEW</Text>
          <View
            style={[styles.previewFrame, { width: previewWidth, aspectRatio: 16 / 9 }]}
          >
            {previewSource.kind === 'gradient' ? (
              <BannerGradient
                presetKey={previewSource.presetKey}
                width={previewWidth}
                height={previewHeight}
                showScrim={false}
              />
            ) : (
              <Image
                source={{ uri: previewSource.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            )}
          </View>
        </View>

        {/* ---- Segmented control ---- */}
        <View style={styles.segmentedWrap}>
          <View style={styles.segmented}>
            {PICKER_TABS.map((tab) => {
              const active = tab.key === state.activeTab;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => onTabChange(tab.key)}
                  style={[styles.segItem, active && styles.segItemActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`${tab.label} mode`}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.segText, active && styles.segTextActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ---- Mode-specific content ---- */}
        {state.activeTab === 'GRADIENT' && (
          <GradientGrid
            selectedKey={
              isBannerPresetKey(state.bannerValue) && state.bannerType === 'GRADIENT'
                ? state.bannerValue
                : null
            }
            onSelect={(key) =>
              setState((prev) => ({
                ...prev,
                bannerType: 'GRADIENT',
                bannerValue: key,
                selectedFilm: null,
              }))
            }
            swatchOuterWidth={swatchOuterWidth}
            swatchOuterHeight={swatchOuterHeight}
          />
        )}

        {state.activeTab === 'BACKDROP' && (
          <BackdropPane
            screenWidth={screenWidth}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            sectionHeader={sectionHeader}
            films={activeFilms}
            loading={filmsLoading}
            error={filmsError}
            selectedFilmId={state.bannerType === 'BACKDROP' ? state.bannerValue : null}
            onSelectFilm={onSelectFilm}
          />
        )}

        {state.activeTab === 'PHOTO' && (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>Photo upload coming soon.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Gradient grid (preserves the existing PR 1a swatch UX)
// ---------------------------------------------------------------------------

function GradientGrid({
  selectedKey,
  onSelect,
  swatchOuterWidth,
  swatchOuterHeight,
}: {
  selectedKey: BannerPresetKey | null;
  onSelect: (key: BannerPresetKey) => void;
  swatchOuterWidth: number;
  swatchOuterHeight: number;
}) {
  return (
    <>
      <Text style={styles.sectionHeader}>CHOOSE A GRADIENT</Text>
      <View style={styles.grid}>
        {BANNER_PRESET_KEYS.map((key) => (
          <SwatchItem
            key={key}
            presetKey={key}
            width={swatchOuterWidth}
            height={swatchOuterHeight}
            isSelected={selectedKey === key}
            onPress={() => onSelect(key)}
          />
        ))}
      </View>
    </>
  );
}

function SwatchItem({
  presetKey,
  width,
  height,
  isSelected,
  onPress,
}: {
  presetKey: BannerPresetKey;
  width: number;
  height: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const preset = getBannerPreset(presetKey);
  const scale = useRef(new Animated.Value(isSelected ? 1.04 : 1)).current;
  const innerW = width - RING_PAD * 2;
  const innerH = height - RING_PAD * 2;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isSelected ? 1.04 : 1,
      damping: 15,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
  }, [isSelected, scale]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Select ${preset.label} gradient`}
      accessibilityState={{ selected: isSelected }}
      style={{ width }}
    >
      <Animated.View
        style={[
          styles.ring,
          {
            backgroundColor: isSelected ? colors.gold : 'transparent',
            transform: [{ scale }],
          },
        ]}
      >
        <View style={styles.swatchInner}>
          <BannerGradient
            presetKey={presetKey}
            width={innerW}
            height={innerH}
            showScrim={false}
          />
        </View>
      </Animated.View>
      <Text style={styles.swatchCaption}>{preset.label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Backdrop mode pane
// ---------------------------------------------------------------------------

function BackdropPane({
  screenWidth,
  searchQuery,
  onSearchChange,
  sectionHeader,
  films,
  loading,
  error,
  selectedFilmId,
  onSelectFilm,
}: {
  screenWidth: number;
  searchQuery: string;
  onSearchChange: (text: string) => void;
  sectionHeader: string;
  films: Film[];
  loading: boolean;
  error: boolean;
  selectedFilmId: string | null;
  onSelectFilm: (film: Film) => void;
}) {
  const posterWidth =
    (screenWidth - POSTER_PAD * 2 - POSTER_GAP * (POSTER_COLS - 1)) / POSTER_COLS;
  const posterHeight = posterWidth * 1.5;

  return (
    <>
      <View style={styles.searchBar}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Circle cx={11} cy={11} r={7} stroke="rgba(245,240,225,0.4)" strokeWidth={2} />
          <Path
            d="M16.5 16.5L21 21"
            stroke="rgba(245,240,225,0.4)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
        <TextInput
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Search films..."
          placeholderTextColor="rgba(245,240,225,0.3)"
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search films"
        />
      </View>

      <Text style={styles.sectionHeader}>{sectionHeader}</Text>

      {loading ? (
        <View style={styles.gridLoading}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error ? (
        <View style={styles.gridLoading}>
          <Text style={styles.errorText}>Couldn't load films</Text>
        </View>
      ) : films.length === 0 ? (
        <View style={styles.gridLoading}>
          <Text style={styles.mutedText}>
            {searchQuery.trim() ? 'No films match that search' : 'No films available'}
          </Text>
        </View>
      ) : (
        <View style={styles.posterGrid}>
          {films.map((film) => (
            <BackdropPosterCell
              key={film.id}
              film={film}
              width={posterWidth}
              height={posterHeight}
              isSelected={selectedFilmId === film.id}
              onPress={() => onSelectFilm(film)}
            />
          ))}
        </View>
      )}
    </>
  );
}

function BackdropPosterCell({
  film,
  width,
  height,
  isSelected,
  onPress,
}: {
  film: Film;
  width: number;
  height: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const posterUri = getPosterUrl(film, 'grid');

  return (
    <Pressable
      onPress={onPress}
      style={{ width }}
      accessibilityRole="button"
      accessibilityLabel={`Select ${film.title}`}
      accessibilityState={{ selected: isSelected }}
    >
      <View
        style={[
          styles.posterThumb,
          { width, height },
          isSelected && styles.posterThumbSelected,
        ]}
      >
        {posterUri && !imgError ? (
          <Image
            source={{ uri: posterUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.posterFallback}>
            <Text style={styles.posterFallbackText} numberOfLines={3}>
              {film.title}
            </Text>
          </View>
        )}
      </View>
      <Text
        style={[styles.posterTitle, isSelected && styles.posterTitleSelected]}
        numberOfLines={1}
      >
        {film.title}
      </Text>
      {film.year ? <Text style={styles.posterYear}>{film.year}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 0,
    padding: 14,
  },
  backChevron: {
    fontSize: 22,
    lineHeight: 24,
    width: 24,
    height: 24,
    textAlign: 'center',
    color: colors.ivory,
    fontWeight: '300',
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.bodySemiBold,
    color: colors.ivory,
  },
  saveBtn: {
    position: 'absolute',
    right: 0,
    padding: 14,
  },
  saveText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.gold,
  },
  saveTextDisabled: {
    color: 'rgba(245,240,225,0.25)',
  },

  // ---- Preview ----
  previewWrap: {
    paddingHorizontal: SWATCH_PAD,
    paddingTop: 8,
    paddingBottom: 4,
  },
  previewLabel: {
    fontSize: 10,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(245,240,225,0.4)',
    letterSpacing: 1,
    marginBottom: 8,
  },
  previewFrame: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(30,30,60,0.6)',
  },

  // ---- Segmented control ----
  segmentedWrap: {
    paddingHorizontal: SWATCH_PAD,
    paddingTop: 16,
    paddingBottom: 4,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245,240,225,0.06)',
    borderRadius: 8,
    padding: 3,
  },
  segItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  segItemActive: {
    backgroundColor: colors.gold,
  },
  segText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: 'rgba(245,240,225,0.5)',
  },
  segTextActive: {
    color: colors.background,
  },

  // ---- Section header (per mockup) ----
  sectionHeader: {
    paddingHorizontal: SWATCH_PAD,
    paddingTop: 14,
    paddingBottom: 8,
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.gold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // ---- Gradient grid (preserved from PR 1a) ----
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SWATCH_PAD,
    gap: SWATCH_GAP,
  },
  ring: {
    padding: RING_PAD,
    borderRadius: 12 + RING_PAD,
  },
  swatchInner: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  swatchCaption: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: 'rgba(245,240,225,0.85)',
    textAlign: 'center',
    marginTop: 8,
  },

  // ---- Search input (BACKDROP) ----
  searchBar: {
    marginHorizontal: SWATCH_PAD,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ivory,
    padding: 0,
  },

  // ---- Backdrop poster grid ----
  posterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: POSTER_PAD,
    gap: POSTER_GAP,
  },
  posterThumb: {
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.12)',
    backgroundColor: 'rgba(30,30,60,0.6)',
    overflow: 'hidden',
  },
  posterThumbSelected: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  posterFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  posterFallbackText: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: 'rgba(245,240,225,0.3)',
    textAlign: 'center',
  },
  posterTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.ivory,
    marginTop: 6,
  },
  posterTitleSelected: {
    color: colors.gold,
  },
  posterYear: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: 'rgba(245,240,225,0.4)',
    marginTop: 1,
  },

  // ---- Loading / error / empty states ----
  gridLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.5)',
  },
  mutedText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.35)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // ---- Photo placeholder ----
  photoPlaceholder: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(245,240,225,0.45)',
    textAlign: 'center',
  },
});
