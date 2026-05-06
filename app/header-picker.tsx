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
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReAnimated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
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
  computePhotoCrop,
  computeSourceCropRect,
  getInitialState,
  getResetStateForTab,
  getStateAfterFilmSelection,
  isSaveEnabled,
  type PickerState,
  type PickerTab,
} from '../src/lib/banner-picker';
import { resolveBannerSource } from '../src/lib/banner-url';
import { uploadBannerPhoto } from '../src/lib/banner-upload';
import { getPosterUrl } from '../src/lib/tmdb-image';
import { useAuth } from '../src/providers/AuthProvider';
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

interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

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
  const { user } = useAuth();
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

  // Photo mode state (PR 1b mobile prompt 3)
  // pickedPhoto is the local image asset from the OS picker (file:// URI
  // + native dimensions). isUploading is true during the crop -> upload
  // -> PATCH chain; the screen dims controls until the chain resolves.
  // translateX/Y are Reanimated shared values so the pan gesture updates
  // on the UI thread without round-tripping through React state.
  const [pickedPhoto, setPickedPhoto] = useState<PickedPhoto | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Save gating. The base check (draft differs from persisted) lives in
  // banner-picker.ts; PHOTO adds two extra runtime gates: a photo must
  // be picked AND we cannot already be uploading.
  const baseSaveEnabled = isSaveEnabled(state, persisted, state.activeTab);
  const saveEnabled =
    state.activeTab === 'PHOTO'
      ? baseSaveEnabled && !!pickedPhoto && !isUploading
      : baseSaveEnabled;

  // Visible save state: `saving` is the legacy gradient/backdrop spinner
  // gate, isUploading is PHOTO-specific. Either one disables Save.
  const savingOrUploading = saving || isUploading;

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
  // Hardware back (no-op while uploading so user cannot abandon mid-PUT)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isUploading) return true; // swallow
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [router, isUploading]);

  // -------------------------------------------------------------------------
  // Tab switch
  // -------------------------------------------------------------------------
  const onTabChange = useCallback(
    (tab: PickerTab) => {
      if (tab === state.activeTab || isUploading) return;
      setState(getResetStateForTab(tab, persisted));
      // Clear any pending search work so we don't apply stale results
      // to the BACKDROP tab on a tab toggle.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
      setSearchQuery('');
      setSearchResults([]);
      setFilmsError(false);
      // Discard any in-progress PHOTO selection; preview reverts to persisted.
      setPickedPhoto(null);
      translateX.value = 0;
      translateY.value = 0;
    },
    [persisted, state.activeTab, isUploading, translateX, translateY],
  );

  // -------------------------------------------------------------------------
  // Film selection (BACKDROP)
  // -------------------------------------------------------------------------
  const onSelectFilm = useCallback((film: Film) => {
    setState((prev) => getStateAfterFilmSelection(prev, film));
  }, []);

  // -------------------------------------------------------------------------
  // Photo picker
  // -------------------------------------------------------------------------
  const pickPhoto = useCallback(async () => {
    try {
      // launchImageLibraryAsync surfaces the iOS / Android system picker.
      // On modern iOS this does NOT require a permission prompt for the
      // full library access we use here (PHPicker is sandboxed). Older
      // platforms / Android may still prompt; if the user denies, the
      // call simply resolves with canceled=true and we no-op.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // we do our own pan-to-reposition crop
        quality: 1,
        exif: false,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      if (!asset.uri || !asset.width || !asset.height) return;
      setPickedPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
      // Reset pan whenever a new photo loads so we start centered.
      translateX.value = 0;
      translateY.value = 0;
      // Flip draft to PHOTO so isSaveEnabled allows save once the user
      // taps Save. bannerValue is empty until upload returns the final
      // pathname; PHOTO save reads pathname from the upload response,
      // not from draft.bannerValue.
      setState((prev) => ({
        ...prev,
        bannerType: 'PHOTO',
        bannerValue: '',
        selectedFilm: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open photo library';
      Alert.alert('Photo picker error', message);
    }
  }, [translateX, translateY]);

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------
  const handleSave = async () => {
    if (!saveEnabled || savingOrUploading) return;
    if (state.activeTab === 'PHOTO') {
      await handlePhotoSave();
      return;
    }
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

  const handlePhotoSave = async () => {
    if (!pickedPhoto) return;
    if (!user?.id) {
      Alert.alert('Save failed', 'Sign in to save a photo banner.');
      return;
    }
    setIsUploading(true);
    try {
      // 1. Crop the visible region of the photo to a 16:9 JPEG using the
      //    final pan offsets. Math is in src/lib/banner-picker.ts so it
      //    can be unit tested without RN in scope.
      const crop = computeSourceCropRect({
        photoWidth: pickedPhoto.width,
        photoHeight: pickedPhoto.height,
        frameWidth: previewWidth,
        frameHeight: previewHeight,
        panX: translateX.value,
        panY: translateY.value,
      });
      const cropped = await ImageManipulator.manipulateAsync(
        pickedPhoto.uri,
        [
          {
            crop: {
              originX: Math.max(0, Math.round(crop.originX)),
              originY: Math.max(0, Math.round(crop.originY)),
              width: Math.round(crop.width),
              height: Math.round(crop.height),
            },
          },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      // 2. Upload to Vercel Blob via the two-step protocol. Returns the
      //    FINAL pathname (random suffix appended server-side).
      const upload = await uploadBannerPhoto({
        fileUri: cropped.uri,
        userId: user.id,
        contentType: 'image/jpeg',
      });
      // 3. PATCH user banner with bannerType=PHOTO and the FINAL pathname.
      await updateUserBanner('PHOTO', upload.pathname);
      router.back();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Could not upload photo. Try again.';
      Alert.alert('Save failed', message);
    } finally {
      setIsUploading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Preview source
  // -------------------------------------------------------------------------
  // The preview reflects the current draft. For BACKDROP, prefer the just-
  // selected film, then fall back to the persisted film record (when the
  // draft equals persisted, e.g. immediately after mount or a tab reset).
  // PHOTO mode handles its own preview rendering below; this resolver
  // returns gradient fallback for PHOTO so the non-photo branches don't
  // need to special-case it.
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

  // Photo preview label changes to indicate the gesture affordance once
  // a photo is loaded. Other modes use the static "PREVIEW" label.
  const showPhotoAdjuster =
    state.activeTab === 'PHOTO' && pickedPhoto !== null;
  const previewLabel = showPhotoAdjuster
    ? 'PREVIEW · DRAG TO REPOSITION'
    : 'PREVIEW';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          disabled={isUploading}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          accessibilityState={{ disabled: isUploading }}
          style={styles.backBtn}
        >
          <Text
            style={[styles.backChevron, isUploading && styles.disabledText]}
          >
            ‹
          </Text>
        </Pressable>
        <Text style={styles.title}>Banner style</Text>
        <Pressable
          onPress={handleSave}
          disabled={!saveEnabled || savingOrUploading}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Save banner"
          accessibilityState={{ disabled: !saveEnabled || savingOrUploading }}
          style={styles.saveBtn}
        >
          {savingOrUploading ? (
            <View style={styles.saveBusyRow}>
              <ActivityIndicator size="small" color={colors.gold} />
              <Text style={[styles.saveText, styles.saveTextBusy]}>Saving...</Text>
            </View>
          ) : (
            <Text
              style={[styles.saveText, !saveEnabled && styles.saveTextDisabled]}
            >
              Save
            </Text>
          )}
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
          <Text style={styles.previewLabel}>{previewLabel}</Text>
          <View
            style={[styles.previewFrame, { width: previewWidth, aspectRatio: 16 / 9 }]}
          >
            {showPhotoAdjuster && pickedPhoto ? (
              <PhotoAdjuster
                photo={pickedPhoto}
                frameWidth={previewWidth}
                frameHeight={previewHeight}
                translateX={translateX}
                translateY={translateY}
              />
            ) : previewSource.kind === 'gradient' ? (
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
        <View
          style={[
            styles.segmentedWrap,
            isUploading && styles.dimmedWhileUploading,
          ]}
          pointerEvents={isUploading ? 'none' : 'auto'}
        >
          <View style={styles.segmented}>
            {PICKER_TABS.map((tab) => {
              const active = tab.key === state.activeTab;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => onTabChange(tab.key)}
                  disabled={isUploading}
                  style={[styles.segItem, active && styles.segItemActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`${tab.label} mode`}
                  accessibilityState={{
                    selected: active,
                    disabled: isUploading,
                  }}
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
          <PhotoPane
            pickedPhoto={pickedPhoto}
            isUploading={isUploading}
            onPickPhoto={pickPhoto}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Photo adjuster (PR 1b mobile prompt 3)
// ---------------------------------------------------------------------------

function PhotoAdjuster({
  photo,
  frameWidth,
  frameHeight,
  translateX,
  translateY,
}: {
  photo: PickedPhoto;
  frameWidth: number;
  frameHeight: number;
  translateX: ReturnType<typeof useSharedValue<number>>;
  translateY: ReturnType<typeof useSharedValue<number>>;
}) {
  // Cover-fit math (bounded pan limits) is captured in useMemo so the
  // worklet's clamp constants are stable for the lifetime of this photo.
  // Reanimated worklets read JS scope via closure capture at gesture
  // creation time; recreating the gesture on dimension change is the
  // safe pattern.
  const { renderedWidth, renderedHeight, maxPanX, maxPanY } = useMemo(
    () =>
      computePhotoCrop({
        photoWidth: photo.width,
        photoHeight: photo.height,
        frameWidth,
        frameHeight,
        panX: translateX.value,
        panY: translateY.value,
      }),
    // translateX/Y values are intentionally NOT in deps; we just need
    // dimensions for the cover-fit, not the live pan offset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [photo.width, photo.height, frameWidth, frameHeight],
  );

  // Save start position so onUpdate's translation deltas accumulate
  // correctly across re-pan gestures.
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          'worklet';
          startX.value = translateX.value;
          startY.value = translateY.value;
        })
        .onUpdate((e) => {
          'worklet';
          const nextX = startX.value + e.translationX;
          const nextY = startY.value + e.translationY;
          translateX.value = nextX < -maxPanX ? -maxPanX : nextX > maxPanX ? maxPanX : nextX;
          translateY.value = nextY < -maxPanY ? -maxPanY : nextY > maxPanY ? maxPanY : nextY;
        }),
    [maxPanX, maxPanY, translateX, translateY, startX, startY],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={StyleSheet.absoluteFill}>
        <ReAnimated.View
          style={[
            {
              position: 'absolute',
              left: (frameWidth - renderedWidth) / 2,
              top: (frameHeight - renderedHeight) / 2,
              width: renderedWidth,
              height: renderedHeight,
            },
            animatedStyle,
          ]}
        >
          <Image
            source={{ uri: photo.uri }}
            style={{ width: renderedWidth, height: renderedHeight }}
            resizeMode="cover"
          />
        </ReAnimated.View>
        <CornerBrackets />
      </View>
    </GestureDetector>
  );
}

function CornerBrackets() {
  // Four gold L-shaped indicators at the frame corners (per mockup
  // Frame 5). 12pt segments with 1.5pt stroke; inset 6pt from each edge.
  const c = colors.gold;
  const len = 12;
  const sw = 1.5;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* TL */}
      <View style={[bracketStyles.corner, { top: 6, left: 6 }]}>
        <View style={{ width: len, height: sw, backgroundColor: c }} />
        <View style={{ width: sw, height: len, backgroundColor: c }} />
      </View>
      {/* TR */}
      <View
        style={[
          bracketStyles.corner,
          { top: 6, right: 6, alignItems: 'flex-end' },
        ]}
      >
        <View style={{ width: len, height: sw, backgroundColor: c }} />
        <View style={{ width: sw, height: len, backgroundColor: c }} />
      </View>
      {/* BL */}
      <View
        style={[
          bracketStyles.corner,
          { bottom: 6, left: 6, justifyContent: 'flex-end' },
        ]}
      >
        <View style={{ width: sw, height: len, backgroundColor: c }} />
        <View style={{ width: len, height: sw, backgroundColor: c }} />
      </View>
      {/* BR */}
      <View
        style={[
          bracketStyles.corner,
          {
            bottom: 6,
            right: 6,
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
          },
        ]}
      >
        <View style={{ width: sw, height: len, backgroundColor: c }} />
        <View style={{ width: len, height: sw, backgroundColor: c }} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Photo pane (PR 1b mobile prompt 3)
//
// Two states: empty (no photo picked) shows the upload CTA + helper, and
// loaded (a photo is picked) shows a "Choose a different photo" secondary
// button + helper. Helper text changes to "Uploading to your account..."
// during the save chain.
// ---------------------------------------------------------------------------

function PhotoPane({
  pickedPhoto,
  isUploading,
  onPickPhoto,
}: {
  pickedPhoto: PickedPhoto | null;
  isUploading: boolean;
  onPickPhoto: () => void;
}) {
  if (!pickedPhoto) {
    return (
      <>
        <View style={styles.photoEmptyIconWrap}>
          <PhotoUploadIcon />
        </View>
        <Pressable
          onPress={onPickPhoto}
          disabled={isUploading}
          accessibilityRole="button"
          accessibilityLabel="Choose photo from library"
          style={[styles.photoPrimaryBtn, isUploading && styles.dimmedWhileUploading]}
        >
          <Text style={styles.photoPrimaryBtnText}>Choose photo from library</Text>
        </Pressable>
        <Text style={styles.photoHelperText}>
          {'JPG or PNG, up to 5MB.\nYou can reposition the crop after selecting.'}
        </Text>
      </>
    );
  }
  return (
    <>
      <Pressable
        onPress={onPickPhoto}
        disabled={isUploading}
        accessibilityRole="button"
        accessibilityLabel="Choose a different photo"
        style={[
          styles.photoSecondaryBtn,
          isUploading && styles.dimmedWhileUploading,
        ]}
      >
        <Text style={styles.photoSecondaryBtnText}>Choose a different photo</Text>
      </Pressable>
      <Text style={styles.photoHelperText}>
        {isUploading
          ? 'Uploading to your account...'
          : 'Drag the photo to reposition. Tap Save when ready.'}
      </Text>
    </>
  );
}

function PhotoUploadIcon() {
  // Decorative 56pt rounded box with a dashed gold border + photo glyph,
  // matching mockup Frame 4. Pure SVG so it scales cleanly.
  return (
    <View style={styles.photoIconBox}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"
          stroke={colors.gold}
          strokeWidth={1.5}
        />
        <Circle cx={9} cy={9} r={2} stroke={colors.gold} strokeWidth={1.5} />
        <Path
          d="M21 15l-5-5L5 21"
          stroke={colors.gold}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
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

const bracketStyles = StyleSheet.create({
  corner: {
    position: 'absolute',
    width: 12,
    height: 12,
  },
});

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
  disabledText: {
    color: 'rgba(245,240,225,0.25)',
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
    minWidth: 80,
    alignItems: 'flex-end',
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
  dimmedWhileUploading: {
    opacity: 0.4,
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

  // ---- Photo pane (PR 1b mobile prompt 3) ----
  photoEmptyIconWrap: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 12,
  },
  photoIconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(200,169,81,0.1)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(200,169,81,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPrimaryBtn: {
    marginHorizontal: SWATCH_PAD,
    marginTop: 4,
    paddingVertical: 14,
    backgroundColor: colors.gold,
    borderRadius: 10,
    alignItems: 'center',
  },
  photoPrimaryBtnText: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    color: colors.background,
  },
  photoSecondaryBtn: {
    marginHorizontal: SWATCH_PAD,
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.2)',
    borderRadius: 10,
    alignItems: 'center',
  },
  photoSecondaryBtnText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.ivory,
  },
  photoHelperText: {
    marginHorizontal: SWATCH_PAD,
    marginTop: 12,
    fontSize: 11,
    fontFamily: fonts.body,
    color: 'rgba(245,240,225,0.45)',
    textAlign: 'center',
    lineHeight: 16,
  },
});
