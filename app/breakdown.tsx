// app/breakdown.tsx
// Full-screen breakdown: donut + legend + income/expense tab.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BreakdownLegend from '../src/components/BreakdownLegend';
import DonutChart from '../src/components/DonutChart';
import { useExpenses } from '../src/context/ExpenseContext';
import { fonts, radius, spacing, type, useTheme } from '../src/theme';
import type { CategoryGroup, TimeRange } from '../src/types';

const CURRENCY_SYMBOL: Record<string, string> = {
  KES: 'KSh',
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  ZAR: 'R',
};

export default function Breakdown() {
  const router = useRouter();
  const { palette } = useTheme();
  const { breakdownForRange, totalsForRange, settings } = useExpenses();

  const [range, setRange] = useState<TimeRange>('month');
  const [group, setGroup] = useState<CategoryGroup>('expense');

  const currencySymbol =
    CURRENCY_SYMBOL[settings.currency] ?? settings.currency;

  const items = breakdownForRange(range, group);
  const totals = totalsForRange(range);
  const total = group === 'expense' ? totals.expense : totals.income;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.background }]}
      edges={['top', 'bottom']}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.topBarBtn}
        >
          <Text style={[styles.topBarBtnText, { color: palette.textMuted }]}>
            Close
          </Text>
        </Pressable>
        <Text style={[type.title, { color: palette.text }]}>Breakdown</Text>
        <View style={styles.topBarBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Range toggle */}
        <View
          style={[
            styles.segment,
            { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
          ]}
        >
          {(['day', 'week', 'month'] as TimeRange[]).map((r) => {
            const active = r === range;
            return (
              <Pressable
                key={r}
                onPress={() => setRange(r)}
                style={[
                  styles.segmentItem,
                  active && { backgroundColor: palette.surface },
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    {
                      color: active ? palette.text : palette.textMuted,
                      fontFamily: active
                        ? fonts.sansSemiBold
                        : fonts.sansMedium,
                    },
                  ]}
                >
                  {r === 'day' ? 'Day' : r === 'week' ? 'Week' : 'Month'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Group toggle */}
        <View
          style={[
            styles.segment,
            {
              backgroundColor: palette.surfaceAlt,
              borderColor: palette.border,
              marginTop: spacing.sm,
            },
          ]}
        >
          {(['expense', 'income'] as CategoryGroup[]).map((g) => {
            const active = g === group;
            const activeColor =
              g === 'expense' ? palette.expense : palette.income;
            return (
              <Pressable
                key={g}
                onPress={() => setGroup(g)}
                style={[
                  styles.segmentItem,
                  active && { backgroundColor: activeColor },
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    {
                      color: active ? '#FFFFFF' : palette.textMuted,
                      fontFamily: active
                        ? fonts.sansSemiBold
                        : fonts.sansMedium,
                    },
                  ]}
                >
                  {g === 'expense' ? 'Expenses' : 'Income'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Donut */}
        <View style={styles.donutWrap}>
          <DonutChart
            data={items}
            size={240}
            strokeWidth={26}
            centerLabel={group === 'expense' ? 'TOTAL SPENT' : 'TOTAL EARNED'}
            centerValue={`${currencySymbol} ${total.toFixed(2)}`}
            centerLabelColor={palette.textMuted}
            centerValueColor={palette.text}
            trackColor={palette.divider}
          />
        </View>

        {/* Legend */}
        <BreakdownLegend
          items={items}
          currencySymbol={currencySymbol}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  topBarBtn: { minWidth: 60 },
  topBarBtnText: { fontFamily: fonts.sansMedium, fontSize: 15 },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },

  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  segmentLabel: { fontSize: 13.5, letterSpacing: 0.3 },

  donutWrap: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
});