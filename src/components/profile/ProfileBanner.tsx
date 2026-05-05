import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import BannerGradient from '../BannerGradient';
import type { BannerPresetKey } from '../../constants/bannerPresets';

const BANNER_HEIGHT = 180;

type ProfileBannerProps = {
  presetKey: BannerPresetKey;
  onEditPress: () => void;
};

export default function ProfileBanner({
  presetKey,
  onEditPress,
}: ProfileBannerProps) {
  // Banner is full-bleed; integration in Phase 4 will need to render this
  // outside any horizontal padding on the parent ScrollView.
  const { width } = useWindowDimensions();

  return (
    <View style={styles.wrap}>
      <BannerGradient
        presetKey={presetKey}
        width={width}
        height={BANNER_HEIGHT}
        showScrim
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit banner"
        onPress={onEditPress}
        hitSlop={8}
        style={styles.editBtn}
      >
        <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.editBtnTint]} />
        <PenIcon />
      </Pressable>
    </View>
  );
}

function PenIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path
        d="M11.5 1.5L14.5 4.5L5 14H2V11Z"
        stroke="#F5F0E1"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: BANNER_HEIGHT, // 180pt; outside theme.spacing scale
    overflow: 'hidden',
    position: 'relative',
  },
  editBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(245,240,225,0.2)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtnTint: {
    backgroundColor: 'rgba(13,13,26,0.6)',
  },
});
