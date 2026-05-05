import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import BannerGradient from '../BannerGradient';
import type { BannerPresetKey } from '../../constants/bannerPresets';

const BANNER_HEIGHT = 180;

type ProfileBannerProps = {
  presetKey: BannerPresetKey;
};

export default function ProfileBanner({ presetKey }: ProfileBannerProps) {
  // Banner is full-bleed; the parent should render this outside any
  // horizontal padding. Customization moved to Settings -> Edit profile.
  const { width } = useWindowDimensions();

  return (
    <View style={styles.wrap}>
      <BannerGradient
        presetKey={presetKey}
        width={width}
        height={BANNER_HEIGHT}
        showScrim
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: BANNER_HEIGHT, // 180pt; outside theme.spacing scale
    overflow: 'hidden',
    position: 'relative',
  },
});
