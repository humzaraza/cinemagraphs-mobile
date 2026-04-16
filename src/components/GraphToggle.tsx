import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, fonts } from '../constants/theme';

export type GraphMode = 'critics' | 'audience' | 'both' | 'merged';

const MODE_CONFIG: Record<GraphMode, { label: string; color: string; borderColor: string }> = {
  critics: { label: 'Critics', color: colors.gold, borderColor: 'rgba(200,169,81,0.3)' },
  audience: { label: 'Audience', color: colors.teal, borderColor: 'rgba(45,212,168,0.3)' },
  both: { label: 'Both', color: colors.gold, borderColor: 'rgba(200,169,81,0.3)' },
  merged: { label: 'Merged', color: colors.ivory, borderColor: 'rgba(245,240,225,0.3)' },
};

const ALL_MODES: GraphMode[] = ['critics', 'audience', 'both', 'merged'];

interface Props {
  active: GraphMode;
  onChange: (mode: GraphMode) => void;
  locked?: boolean;
}

export default function GraphToggle({ active, onChange, locked }: Props) {
  const [expanded, setExpanded] = useState(false);
  const widthAnim = useRef(new Animated.Value(0)).current;
  const optionsOpacity = useRef(new Animated.Value(0)).current;

  const cfg = MODE_CONFIG[active];

  const expand = () => {
    console.log('[GraphToggle] pill tapped, expanded:', expanded);
    if (locked) return;
    setExpanded(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    Animated.spring(widthAnim, { toValue: 1, friction: 10, tension: 120, useNativeDriver: false }).start();
    Animated.timing(optionsOpacity, { toValue: 1, duration: 150, delay: 50, useNativeDriver: true }).start();
  };

  const collapse = (newMode?: GraphMode) => {
    const modeChanged = newMode && newMode !== active;
    if (modeChanged) {
      try { Haptics.selectionAsync(); } catch (e) {}
    }
    Animated.timing(optionsOpacity, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      Animated.spring(widthAnim, { toValue: 0, friction: 10, tension: 120, useNativeDriver: false }).start(() => {
        setExpanded(false);
        if (modeChanged) onChange(newMode);
      });
    });
  };

  const pillWidth = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [90, 280],
  });

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

  return (
    <View style={{ position: 'relative' }}>
      {/* Dismiss overlay: large area behind the pill to catch outside taps */}
      {expanded && (
        <Pressable
          onPress={() => collapse()}
          style={{ position: 'absolute', zIndex: 1, top: -500, left: -500, right: -500, bottom: -500 }}
        />
      )}

      {/* Pill: sits above the overlay */}
      <Pressable
        onPress={expanded ? undefined : expand}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ zIndex: 2 }}
      >
        <Animated.View
          style={[
            st.pill,
            { borderColor: cfg.borderColor, width: expanded ? pillWidth : undefined },
          ]}
        >
          {!expanded ? (
            <View style={st.collapsedRow}>
              <Text style={[st.pillText, { color: cfg.color }]}>{cfg.label}</Text>
              <Text style={[st.chevron, { color: cfg.color }]}>{'\u25BE'}</Text>
            </View>
          ) : (
            <Animated.View style={[st.expandedRow, { opacity: optionsOpacity }]}>
              {ALL_MODES.map((mode) => {
                const mc = MODE_CONFIG[mode];
                const isActive = mode === active;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => {
                      console.log('[GraphToggle] option tapped:', mode);
                      collapse(mode);
                    }}
                    style={[
                      st.option,
                      isActive && { backgroundColor: mc.color + '1A' },
                    ]}
                  >
                    <Text
                      style={[
                        st.optionText,
                        { color: isActive ? mc.color : 'rgba(245,240,225,0.45)' },
                      ]}
                    >
                      {mc.label}
                    </Text>
                  </Pressable>
                );
              })}
            </Animated.View>
          )}
        </Animated.View>
      </Pressable>
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
  collapsedRow: {
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
  expandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  option: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  optionText: {
    fontSize: 12,
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
