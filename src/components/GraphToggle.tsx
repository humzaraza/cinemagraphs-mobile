import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../constants/theme';

export type GraphMode = 'critics' | 'audience' | 'both' | 'merged';

const MODE_CONFIG: Record<GraphMode, { label: string; color: string; borderColor: string }> = {
  critics: { label: 'Critics', color: colors.gold, borderColor: 'rgba(200,169,81,0.3)' },
  audience: { label: 'Audience', color: colors.teal, borderColor: 'rgba(45,212,168,0.3)' },
  both: { label: 'Both', color: colors.gold, borderColor: 'rgba(200,169,81,0.3)' },
  merged: { label: 'Merged', color: colors.ivory, borderColor: 'rgba(245,240,225,0.3)' },
};

const ALL_MODES: GraphMode[] = ['critics', 'audience', 'both', 'merged'];
const POPOVER_WIDTH = 140;

interface Props {
  active: GraphMode;
  onChange: (mode: GraphMode) => void;
  locked?: boolean;
}

export default function GraphToggle({ active, onChange, locked }: Props) {
  const [open, setOpen] = useState(false);
  const [pillLayout, setPillLayout] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const pillRef = useRef<View>(null);
  const popoverOpacity = useRef(new Animated.Value(0)).current;
  const popoverTranslateY = useRef(new Animated.Value(6)).current;
  const popoverScale = useRef(new Animated.Value(0.96)).current;

  const cfg = MODE_CONFIG[active];

  const measure = useCallback((cb: (layout: { x: number; y: number; w: number; h: number }) => void) => {
    pillRef.current?.measureInWindow((x, y, w, h) => {
      cb({ x, y, w, h });
    });
  }, []);

  const openPopover = () => {
    console.log('[GraphToggle] pill tapped, open:', open);
    if (locked || open) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    measure((layout) => {
      setPillLayout(layout);
      setOpen(true);
      popoverOpacity.setValue(0);
      popoverTranslateY.setValue(6);
      popoverScale.setValue(0.96);
      Animated.parallel([
        Animated.timing(popoverOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(popoverTranslateY, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(popoverScale, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    });
  };

  const closePopover = (newMode?: GraphMode) => {
    if (newMode && newMode !== active) {
      console.log('[GraphToggle] option tapped:', newMode);
      try { Haptics.selectionAsync(); } catch (e) {}
      onChange(newMode);
    }
    Animated.parallel([
      Animated.timing(popoverOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(popoverTranslateY, { toValue: 6, duration: 100, useNativeDriver: true }),
      Animated.timing(popoverScale, { toValue: 0.96, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      setOpen(false);
    });
  };

  if (locked) {
    return (
      <View>
        <View style={[st.pill, { borderColor: cfg.borderColor }]}>
          <Text style={[st.pillText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={st.lockedCaption}>No audience data yet</Text>
      </View>
    );
  }

  // Position popover above the pill by default
  let popoverTop = 0;
  if (pillLayout) {
    const abovePill = pillLayout.y - 8;
    // If too close to top of screen, place below instead
    if (abovePill < 120) {
      popoverTop = pillLayout.h + 8;
    } else {
      // popoverTop is negative (above the pill), measured from pill top
      // Estimate popover height: 4 rows * ~34px each + 8px padding = ~144px
      popoverTop = -(144 + 8);
    }
  }

  return (
    <View style={{ position: 'relative', zIndex: 10 }}>
      {/* Pill (fixed size, always visible) */}
      <Pressable
        ref={pillRef as any}
        onPress={openPopover}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={[st.pill, { borderColor: cfg.borderColor }]}>
          <View style={st.pillRow}>
            <Text style={[st.pillText, { color: cfg.color }]}>{cfg.label}</Text>
            <Text style={[st.chevron, { color: cfg.color }]}>{'\u25BE'}</Text>
          </View>
        </View>
      </Pressable>

      {/* Popover + dismiss overlay */}
      {open && (
        <>
          {/* Full-screen dismiss overlay */}
          <Pressable
            onPress={() => closePopover()}
            style={{ position: 'absolute', zIndex: 11, top: -500, left: -500, right: -500, bottom: -500 }}
          />

          {/* Popover */}
          <Animated.View
            style={[
              st.popover,
              {
                zIndex: 12,
                top: popoverTop,
                left: 0,
                opacity: popoverOpacity,
                transform: [
                  { translateY: popoverTranslateY },
                  { scale: popoverScale },
                ],
              },
            ]}
          >
            {ALL_MODES.map((mode) => {
              const mc = MODE_CONFIG[mode];
              const isActive = mode === active;
              return (
                <Pressable
                  key={mode}
                  onPress={() => closePopover(mode)}
                  style={[
                    st.popoverRow,
                    isActive && { backgroundColor: mc.color + '1A' },
                  ]}
                >
                  <Text
                    style={[
                      st.popoverLabel,
                      { color: isActive ? mc.color : 'rgba(245,240,225,0.45)' },
                    ]}
                  >
                    {mc.label}
                  </Text>
                </Pressable>
              );
            })}
          </Animated.View>
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  pill: {
    borderRadius: 14,
    borderWidth: 0.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'DMSans_500Medium',
  },
  chevron: {
    fontSize: 10,
    marginTop: 1,
  },
  popover: {
    position: 'absolute',
    width: POPOVER_WIDTH,
    backgroundColor: 'rgba(20,20,40,0.98)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(200,169,81,0.2)',
    padding: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  popoverRow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  popoverLabel: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'DMSans_500Medium',
  },
  lockedCaption: {
    fontSize: 11,
    color: 'rgba(245,240,225,0.35)',
    fontStyle: 'italic',
    fontFamily: 'DMSans_400Regular',
    marginTop: 4,
  },
});
