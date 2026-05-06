import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Alert,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../src/constants/theme';
import BannerGradient from '../src/components/BannerGradient';
import SectionHeader from '../src/components/profile/SectionHeader';
import {
  BANNER_PRESET_KEYS,
  getBannerPreset,
  type BannerPresetKey,
} from '../src/constants/bannerPresets';
import { updateUserBanner } from '../src/lib/api';

const PREVIEW_HEIGHT = 120;
const SWATCH_PAD = 20;
const SWATCH_GAP = 16;
const RING_PAD = 3;
const BANNER_RATIO = 393 / 180; // 2.18

export default function HeaderPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { current } = useLocalSearchParams<{ current?: string }>();

  // Saved value at mount, passed in by the profile screen via the `current`
  // route param. Held in a ref so the dirty check stays anchored to the
  // value the user opened the picker with. Falls back to the first preset
  // if the param is missing or doesn't match the locked tuple (e.g. PHOTO
  // banner type once that ships).
  const savedKey = useRef<BannerPresetKey>(
    BANNER_PRESET_KEYS.includes(current as BannerPresetKey)
      ? (current as BannerPresetKey)
      : BANNER_PRESET_KEYS[0],
  ).current;

  const [inProgressKey, setInProgressKey] = useState<BannerPresetKey>(savedKey);
  const [saving, setSaving] = useState(false);

  const isDirty = inProgressKey !== savedKey;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [router]);

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      await updateUserBanner('GRADIENT', inProgressKey);
      router.back();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save banner';
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  const swatchOuterWidth = (screenWidth - SWATCH_PAD * 2 - SWATCH_GAP) / 2;
  const swatchOuterHeight = swatchOuterWidth / BANNER_RATIO;

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
        <Text style={styles.title}>Banner</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <BannerGradient
          presetKey={inProgressKey}
          width={screenWidth}
          height={PREVIEW_HEIGHT}
          showScrim={false}
        />

        <SectionHeader title="CHOOSE A GRADIENT" />

        <View style={styles.grid}>
          {BANNER_PRESET_KEYS.map((key) => (
            <SwatchItem
              key={key}
              presetKey={key}
              width={swatchOuterWidth}
              height={swatchOuterHeight}
              isSelected={inProgressKey === key}
              onPress={() => setInProgressKey(key)}
            />
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.saveBar,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Pressable
          onPress={handleSave}
          disabled={!isDirty || saving}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Save banner"
          accessibilityState={{ disabled: !isDirty || saving }}
          style={[styles.saveBtn, (!isDirty || saving) && styles.saveBtnDisabled]}
        >
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
        </Pressable>
      </View>
    </View>
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
  saveBar: {
    paddingTop: 12,
  },
  saveBtn: {
    alignSelf: 'center',
    minWidth: '80%',
    borderRadius: 99,
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: colors.gold,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveText: {
    fontSize: 14,
    fontFamily: fonts.bodySemiBold,
    color: colors.background,
    letterSpacing: 0.14,
  },
});
