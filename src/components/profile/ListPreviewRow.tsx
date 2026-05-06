import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { colors, fonts } from '../../constants/theme';
import { getPosterUrl } from '../../lib/tmdb-image';

export type List = {
  id: string;
  name: string;
  filmCount: number;
  mosaicPosters: string[];
};

type ListPreviewRowProps = {
  list: List;
  onPress: (listId: string) => void;
  isLast: boolean;
};

export default function ListPreviewRow({
  list,
  onPress,
  isLast,
}: ListPreviewRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open list ${list.name}`}
      onPress={() => onPress(list.id)}
      style={[
        styles.row,
        !isLast && styles.rowBorder,
      ]}
    >
      <View style={styles.mosaic}>
        {[0, 1, 2, 3].map((i) => {
          const poster = list.mosaicPosters[i];
          const uri = poster
            ? getPosterUrl({ posterUrl: poster }, 'thumbnail')
            : null;
          return (
            <View key={i} style={styles.cell}>
              {uri ? (
                <Image
                  source={{ uri }}
                  style={styles.cellImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.cellImage, styles.cellPlaceholder]} />
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.info}>
        <Text
          style={styles.title}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {list.name}
        </Text>
        <Text style={styles.meta}>{list.filmCount} films</Text>
      </View>

      {/* U+203A SINGLE RIGHT-POINTING ANGLE QUOTATION MARK as chevron;
          renders cleanly across iOS/Android system fonts. */}
      <Text style={styles.chevron}>{'›'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(245,240,225,0.06)',
  },
  mosaic: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '50%',
    height: '50%',
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
  cellPlaceholder: {
    backgroundColor: 'rgba(30,30,60,0.4)',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontFamily: fonts.bodySemiBold,
    letterSpacing: -0.15,
    color: colors.ivory,
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(245,240,225,0.5)',
  },
  chevron: {
    fontSize: 18,
    color: 'rgba(245,240,225,0.3)',
    flexShrink: 0,
  },
});
