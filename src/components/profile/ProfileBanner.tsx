import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import BannerGradient from '../BannerGradient';
import type { BannerPresetKey } from '../../constants/bannerPresets';

const BANNER_HEIGHT = 180;

type ProfileBannerProps = {
  presetKey: BannerPresetKey;
  onMenuPress: () => void;
};

export default function ProfileBanner({
  presetKey,
  onMenuPress,
}: ProfileBannerProps) {
  // Banner is full-bleed; the parent should render this outside any
  // horizontal padding. The 3-dots affordance opens a profile-actions
  // bottom sheet (Edit profile / Banner style / Settings).
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
        accessibilityLabel="Profile menu"
        onPress={onMenuPress}
        hitSlop={8}
        style={styles.menuBtn}
      >
        <DotsIcon />
      </Pressable>
    </View>
  );
}

function DotsIcon() {
  // Three vertical dots, ivory at 0.9 alpha so they read against any preset.
  const fill = 'rgba(245,240,225,0.9)';
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Circle cx={8} cy={3.5} r={1.5} fill={fill} />
      <Circle cx={8} cy={8} r={1.5} fill={fill} />
      <Circle cx={8} cy={12.5} r={1.5} fill={fill} />
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
  menuBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(245,240,225,0.2)',
    backgroundColor: 'rgba(13,13,26,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
