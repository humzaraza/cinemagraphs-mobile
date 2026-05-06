import React from 'react';
import { View, StyleSheet } from 'react-native';
import EmptyStateCard from './EmptyStateCard';
import ListPreviewRow, { type List } from './ListPreviewRow';

type ListsPreviewProps = {
  lists: List[];
  onPressList: (listId: string) => void;
  onCreateList: () => void;
};

export default function ListsPreview({
  lists,
  onPressList,
  onCreateList,
}: ListsPreviewProps) {
  if (lists.length === 0) {
    return (
      <EmptyStateCard
        icon="◫"
        title="No lists yet"
        body="Group films that share an emotional shape, theme, or vibe."
        ctaLabel="Create your first list"
        onCtaPress={onCreateList}
      />
    );
  }

  const visible = lists.slice(0, 3);

  return (
    <View style={styles.wrap}>
      {visible.map((list, i) => (
        <ListPreviewRow
          key={list.id}
          list={list}
          onPress={onPressList}
          isLast={i === visible.length - 1}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
  },
});
