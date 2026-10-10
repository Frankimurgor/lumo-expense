// src/components/BreakdownLegend.tsx
// Legend rows that pair with DonutChart. Each row shows emoji, name,
// share %, and amount. Tap → optional handler.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts, radius, spacing, type, useTheme } from '../theme';
import type { CategoryBreakdownItem } from '../types';

type Props = {
  items: CategoryBreakdownItem[];
  currencySymbol: string;
  onPressItem?: (item: CategoryBreakdownItem) => void;
};

export default function BreakdownLegend({
  items,
  currencySymbol,
  onPressItem,
}: Props) {
  const { palette } = useTheme();

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[type.caption, { color: palette.textMuted }]}>
          Nothing to show yet.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      {items.map((item, idx) => {
        const pct = (item.share * 100).toFixed(0);
        const isLast = idx === items.length - 1;
        return (
          <Pressable
            key={item.categoryId}
            onPress={onPressItem ? () => onPressItem(item) : undefined}
            disabled={!onPressItem}
            style={({ pressed }) => [
              styles.row,
              !isLast && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: palette.divider,
              },
              pressed && onPressItem && { backgroundColor: palette.surfaceAlt },
            ]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: item.color },
              ]}
            />
            <Text style={styles.emoji}>{item.emoji}</Text>
            <View style={{ flex: 1, marginLeft: spacing.xs }}>
              <Text
                style={[type.bodyStrong, { color: palette.text }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                style={[type.caption, { color: palette.textMuted, marginTop: 1 }]}
              >
                {pct}% of total
              </Text>
            </View>
            <Text style={[styles.amount, { color: palette.text }]}>
              {currencySymbol} {item.amount.toFixed(2)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  emoji: { fontSize: 18 },
  amount: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14.5,
    marginLeft: spacing.sm,
  },
});