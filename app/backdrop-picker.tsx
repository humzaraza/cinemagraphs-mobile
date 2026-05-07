import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Alert,
  BackHandler,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../src/constants/theme';
import {
  getBackdrops,
  updateUserBanner,
  type Backdrop,
  type BannerType,
} from '../src/lib/api';
import {
  getCachedBackdrops,
  setCachedBackdrops,
} from '../src/lib/backdrop-cache';
import { getBackdropUrl } from '../src/lib/tmdb-image';
import { parseBackdropBannerValue } from '../src/lib/banner-url';

const EDGE_PAD = 16;
const GRID_GAP = 8;
const GRID_COLS = 2;

function parseBannerType(raw: string | string[] | undefined): BannerType | null {
  if (raw === 'BACKDROP' || raw === 'PHOTO' || raw === 'GRADIENT') return raw;
  return null;
}

function paramAsString(raw: string | string[] | undefined): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return '';
}

// Default highlight rule (locked contract): if the user's persisted state
// is a BACKDROP for THIS film AND the persisted backdropPath matches a
// returned file_path, highlight that one. Otherwise highlight the first
// backdrop in the array (response is sorted vote_count DESC, so this is
// the most-voted backdrop and a reasonable default).
function pickInitialFilePath(
  backdrops: Backdrop[],
  currentFilmId: string,
  persistedBannerType: BannerType | null,
  persistedBannerValue: string,
): string | null {
  if (backdrops.length === 0) return null;
  if (persistedBannerType === 'BACKDROP' && persistedBannerValue) {
    const parsed = parseBackdropBannerValue(persistedBannerValue);
    if (
      parsed &&
      parsed.filmId === currentFilmId &&
      parsed.backdropPath &&
      backdrops.some((b) => b.file_path === parsed.backdropPath)
    ) {
      return parsed.backdropPath;
    }
  }
  return backdrops[0].file_path;
}

// Save enable rule (locked contract): disabled when current selection's
// file_path equals the persisted state's backdropPath for the same film.
// A null persistedBackdropPath (legacy / migrated row) means any explicit
// selection is "different" enough to enable Save.
function isSaveEnabled(
  selectedFilePath: string | null,
  currentFilmId: string,
  persistedBannerType: BannerType | null,
  persistedBannerValue: string,
): boolean {
  if (!selectedFilePath) return false;
  if (persistedBannerType !== 'BACKDROP') return true;
  const parsed = parseBackdropBannerValue(persistedBannerValue);
  if (!parsed || parsed.filmId !== currentFilmId) return true;
  // Same film, same persisted backdropPath: nothing to save.
  return parsed.backdropPath !== selectedFilePath;
}

export default function BackdropPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{
    filmId?: string;
    filmTitle?: string;
    filmYear?: string;
    persistedBannerType?: string;
    persistedBannerValue?: string;
  }>();

  // Anchor route params at mount in a ref. The picker pushes them once;
  // they don't change for the lifetime of this screen.
  const filmId = useRef(paramAsString(params.filmId)).current;
  const filmTitle = useRef(paramAsString(params.filmTitle)).current;
  const filmYear = useRef(paramAsString(params.filmYear)).current;
  const persistedBannerType = useRef(parseBannerType(params.persistedBannerType)).current;
  const persistedBannerValue = useRef(paramAsString(params.persistedBannerValue)).current;

  const [backdrops, setBackdrops] = useState<Backdrop[] | null>(() =>
    filmId ? getCachedBackdrops(filmId) : null,
  );
  const [loading, setLoading] = useState<boolean>(() => !backdrops);
  const [saving, setSaving] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(() => {
    if (!backdrops || !filmId) return null;
    return pickInitialFilePath(backdrops, filmId, persistedBannerType, persistedBannerValue);
  });

  // Auto-save guard: ensure we only fire the single-backdrop auto-save
  // path once per mount, even across the load -> setBackdrops re-render.
  const autoSavedRef = useRef(false);

  // -------------------------------------------------------------------------
  // Hardware back (no-op while saving so user cannot abandon mid-PATCH)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (saving) return true;
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [router, saving]);

  // -------------------------------------------------------------------------
  // Save action (called on tap AND from the single-backdrop auto-save path)
  // -------------------------------------------------------------------------
  const performSave = useCallback(
    async (filePath: string) => {
      if (saving) return;
      setSaving(true);
      try {
        await updateUserBanner('BACKDROP', {
          filmId,
          backdropPath: filePath,
        });
        // Pop both screens (backdrop-picker + header-picker) back to
        // whatever pushed the picker (Profile via the 3-dots menu, or
        // Settings). dismiss(2) is precise; dismissAll() risks popping
        // beyond the picker into the (tabs) layout.
        router.dismiss(2);
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : 'Could not save banner. Please try again.';
        Alert.alert('Save failed', message);
        setSaving(false);
        // Selection is preserved (selectedFilePath state untouched).
      }
    },
    [saving, filmId, router],
  );

  // -------------------------------------------------------------------------
  // Initial load: cache hit -> use cached data; cache miss -> fetch.
  // Empty / errored response -> Alert and pop back to picker.
  // Single-backdrop response -> auto-save and pop both screens.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!filmId) {
      Alert.alert('Could not load backdrop options for this film');
      router.back();
      return;
    }
    // Cache hit: handled in the initial state above. Just run the
    // length-based branches.
    const cached = getCachedBackdrops(filmId);
    if (cached) {
      handleLoaded(cached);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getBackdrops(filmId)
      .then((list) => {
        if (cancelled) return;
        setCachedBackdrops(filmId, list);
        setBackdrops(list);
        handleLoaded(list);
      })
      .catch(() => {
        if (cancelled) return;
        Alert.alert('Could not load backdrop options for this film');
        router.back();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // We intentionally only depend on filmId; the rest of the state used
    // here (router, performSave) is stable for the lifetime of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filmId]);

  // Side effects post-load: handle empty array, single-item auto-save,
  // and initial selection. Centralised here so both cache-hit and
  // cache-miss paths share the logic.
  function handleLoaded(list: Backdrop[]) {
    if (list.length === 0) {
      Alert.alert('Could not load backdrop options for this film');
      router.back();
      return;
    }
    const initial = pickInitialFilePath(
      list,
      filmId,
      persistedBannerType,
      persistedBannerValue,
    );
    setSelectedFilePath(initial);
    if (list.length === 1 && initial && !autoSavedRef.current) {
      autoSavedRef.current = true;
      performSave(initial);
    }
  }

  const saveEnabled = isSaveEnabled(
    selectedFilePath,
    filmId,
    persistedBannerType,
    persistedBannerValue,
  );

  const onTapBackdrop = useCallback(
    (filePath: string) => {
      if (saving) return;
      setSelectedFilePath(filePath);
    },
    [saving],
  );

  const onSavePress = useCallback(() => {
    if (!saveEnabled || saving || !selectedFilePath) return;
    performSave(selectedFilePath);
  }, [saveEnabled, saving, selectedFilePath, performSave]);

  // ---- Layout dimensions ----
  const previewWidth = screenWidth - EDGE_PAD * 2;
  const previewHeight = (previewWidth * 9) / 16;

  const cellWidth = (screenWidth - EDGE_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
  const cellHeight = (cellWidth * 9) / 16;

  const previewUri = selectedFilePath
    ? getBackdropUrl(selectedFilePath, 'preview')
    : null;

  const subtitle = useMemo(() => {
    if (!filmTitle) return '';
    if (filmYear) return `${filmTitle} (${filmYear})`;
    return filmTitle;
  }, [filmTitle, filmYear]);

  const sectionCount = loading
    ? 'Loading...'
    : `${(backdrops?.length ?? 0)} from TMDB`;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          disabled={saving}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          accessibilityState={{ disabled: saving }}
          style={styles.backBtn}
        >
          <Text style={[styles.backChevron, saving && styles.disabledText]}>‹</Text>
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            Backdrops
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onSavePress}
          disabled={!saveEnabled || saving}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Save banner"
          accessibilityState={{ disabled: !saveEnabled || saving }}
          style={styles.saveBtn}
        >
          {saving ? (
            <View style={styles.saveBusyRow}>
              <ActivityIndicator size="small" color={colors.gold} />
              <Text style={[styles.saveText, styles.saveTextBusy]}>Saving...</Text>
            </View>
          ) : (
            <Text style={[styles.saveText, !saveEnabled && styles.saveTextDisabled]}>
              Save
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Live preview (16:9 WYSIWYG) ---- */}
        <View style={styles.previewWrap}>
          <Text style={styles.previewLabel}>PREVIEW</Text>
          <View
            style={[
              styles.previewFrame,
              { width: previewWidth, aspectRatio: 16 / 9 },
            ]}
          >
            {loading || !previewUri ? (
              <SkeletonBox />
            ) : (
              <Image
                source={{ uri: previewUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            )}
          </View>
        </View>

        {/* ---- Section header ---- */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>AVAILABLE BACKDROPS</Text>
          <Text style={styles.sectionCount}>· {sectionCount}</Text>
        </View>

        {/* ---- Grid ---- */}
        {loading ? (
          <View style={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                style={[styles.cell, { width: cellWidth, height: cellHeight }]}
              >
                <SkeletonBox />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.grid}>
            {(backdrops ?? []).map((b) => {
              const selected = b.file_path === selectedFilePath;
              const thumbUri = getBackdropUrl(b.file_path, 'thumbnail');
              return (
                <Pressable
                  key={b.file_path}
                  onPress={() => onTapBackdrop(b.file_path)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Backdrop option"
                  accessibilityState={{ selected, disabled: saving }}
                  style={[
                    styles.cell,
                    { width: cellWidth, height: cellHeight },
                    selected && styles.cellSelected,
                  ]}
                >
                  {thumbUri ? (
                    <Image
                      source={{ uri: thumbUri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.thumbFallback]} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ---- Attribution (TMDB ToS) ---- */}
        <Text style={styles.attribution}>
          Backdrops from The Movie Database (TMDB)
        </Text>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Skeleton placeholder (same pulse pattern used by Explore + Search)
// ---------------------------------------------------------------------------

function SkeletonBox() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: 'rgba(245,240,225,0.06)', opacity },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  backBtn: {
    position: 'absolute',
    left: 0,
    padding: 14,
    zIndex: 1,
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
  disabledText: {
    color: 'rgba(245,240,225,0.25)',
  },
  titleWrap: {
    alignItems: 'center',
    paddingHorizontal: 56, // clear the back / save buttons
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.bodySemiBold,
    color: colors.ivory,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: 'rgba(245,240,225,0.5)',
    marginTop: 2,
  },
  saveBtn: {
    position: 'absolute',
    right: 0,
    padding: 14,
    minWidth: 80,
    alignItems: 'flex-end',
    zIndex: 1,
  },
  saveBusyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.gold,
  },
  saveTextDisabled: {
    color: 'rgba(245,240,225,0.25)',
  },
  saveTextBusy: {
    color: 'rgba(245,240,225,0.5)',
  },

  // ---- Preview ----
  previewWrap: {
    paddingHorizontal: EDGE_PAD,
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

  // ---- Section header ----
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: EDGE_PAD,
    paddingTop: 18,
    paddingBottom: 8,
    gap: 6,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.gold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: 'rgba(245,240,225,0.4)',
    letterSpacing: 0.4,
  },

  // ---- Grid ----
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: EDGE_PAD,
    gap: GRID_GAP,
  },
  cell: {
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.12)',
    backgroundColor: 'rgba(30,30,60,0.6)',
    overflow: 'hidden',
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  thumbFallback: {
    backgroundColor: 'rgba(30,30,60,0.6)',
  },

  // ---- Attribution ----
  attribution: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: 'rgba(245,240,225,0.3)',
    textAlign: 'center',
    paddingHorizontal: EDGE_PAD,
    paddingTop: 18,
  },
});
