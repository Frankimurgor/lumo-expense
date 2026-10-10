// app/(tabs)/index.tsx
// Home — date hero, range-aware balance, totals, mini donut, recent list, FAB.

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DonutChart from '../../src/components/DonutChart';
import { useExpenses } from '../../src/context/ExpenseContext';
import { fonts, radius, spacing, type, useTheme } from '../../src/theme';
import type { TimeRange, Transaction } from '../../src/types';
import { formatRelativeDay } from '../../src/utils/date';
import { money, moneyCompact, symbolFor } from '../../src/utils/money';

// ─── Header formatting ──────────────────────────────────────

const MONTHS_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const DAYS_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
];

function longDayName(): string {
  return DAYS_LONG[new Date().getDay()];
}

function shortDateStamp(): string {
  const d = new Date();
  return `${DAYS_SHORT[d.getDay()]} · ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function balanceLabelForRange(r: TimeRange): string {
  if (r === 'day') return 'TODAY · NET';
  if (r === 'week') return 'THIS WEEK · NET';
  return 'THIS MONTH · NET';
}

// ─── Screen ────────────────────────────────────────────────

export default function Home() {
  const { palette } = useTheme();
  const router = useRouter();
  const {
    ready,
    settings,
    totalsForRange,
    transactionsInRange,
    transactions,
    breakdownForRange,
    getCategory,
    runDueRecurring,
    recurringRules,
  } = useExpenses();

  useEffect(() => {
    if (!ready) return;
    if (recurringRules.length === 0) return;
    runDueRecurring().catch(() => {
      // Silent — the recurring screen has a manual "Check now"
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const [range, setRange] = useState<TimeRange>('day');
  const [fabVisible, setFabVisible] = useState(true);

  const currencySymbol = symbolFor(settings.currency);

  const totals = useMemo(
    () => totalsForRange(range),
    [totalsForRange, range]
  );

  const inRange = useMemo(
    () => transactionsInRange(range),
    [transactionsInRange, range]
  );

  const recent = useMemo(() => {
    return [...inRange]
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return b.createdAt - a.createdAt;
      })
      .slice(0, 6);
  }, [inRange]);

  const expenseBreakdown = useMemo(
    () => breakdownForRange(range, 'expense').slice(0, 5),
    [breakdownForRange, range]
  );

  const hasAny = transactions.length > 0;
  const hasRangeExpense = totals.expense > 0;

  // ─── FAB auto-hide on scroll ──────────────────────────────
  const fabAnim = useRef(new Animated.Value(1)).current;
  const lastY = useRef(0);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY.current;
    const nearTop = y < 40;
    const goingDown = dy > 8;
    const goingUp = dy < -8;

    if (nearTop) {
      if (!fabVisible) setFabVisible(true);
    } else if (goingDown && fabVisible) {
      setFabVisible(false);
    } else if (goingUp && !fabVisible) {
      setFabVisible(true);
    }

    lastY.current = y;
  };

  useEffect(() => {
    Animated.timing(fabAnim, {
      toValue: fabVisible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [fabVisible, fabAnim]);

  const fabTranslateY = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [120, 0],
  });

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.background }]}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Header — date hero */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={[styles.brand, { color: palette.textMuted }]}>
              LUMO EXPENSE
            </Text>
            <Text style={[styles.dateStamp, { color: palette.textMuted }]}>
              {shortDateStamp()}
            </Text>
          </View>
          <Text style={[styles.dayHero, { color: palette.text }]}>
            {longDayName()}
          </Text>
        </View>

        {/* Balance card — follows Day/Week/Month */}
        {settings.showBalance ? (
          <View
            style={[
              styles.balanceCard,
              {
                backgroundColor: palette.primary,
                shadowColor: palette.primaryDark,
              },
            ]}
          >
            <Text style={[styles.balanceLabel, { color: '#CBD2F0' }]}>
              {balanceLabelForRange(range)}
            </Text>
            <Text style={[styles.balanceValue, { color: palette.onPrimary }]}>
              {money(totals.net, currencySymbol)}
            </Text>

            <View style={styles.balanceRow}>
              <View style={styles.balanceCell}>
                <Text style={[styles.balanceCellLabel, { color: '#CBD2F0' }]}>
                  INCOME
                </Text>
                <Text style={[styles.balanceCellValue, { color: '#A5D6A7' }]}>
                  {money(totals.income, currencySymbol)}
                </Text>
              </View>
              <View
                style={[
                  styles.balanceDivider,
                  { backgroundColor: 'rgba(255,255,255,0.15)' },
                ]}
              />
              <View style={styles.balanceCell}>
                <Text style={[styles.balanceCellLabel, { color: '#CBD2F0' }]}>
                  EXPENSE
                </Text>
                <Text style={[styles.balanceCellValue, { color: '#EF9A9A' }]}>
                  {money(totals.expense, currencySymbol)}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Range toggle */}
        <View
          style={[
            styles.segment,
            {
              backgroundColor: palette.surfaceAlt,
              borderColor: palette.border,
            },
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

        {/* Totals row */}
        <View style={styles.totalsRow}>
          <TotalCard
            label="Income"
            value={moneyCompact(totals.income, currencySymbol)}
            color={palette.income}
            bg={palette.surface}
            border={palette.border}
            textColor={palette.text}
            mutedColor={palette.textMuted}
          />
          <TotalCard
            label="Expense"
            value={moneyCompact(totals.expense, currencySymbol)}
            color={palette.expense}
            bg={palette.surface}
            border={palette.border}
            textColor={palette.text}
            mutedColor={palette.textMuted}
          />
          <TotalCard
            label="Net"
            value={moneyCompact(totals.net, currencySymbol)}
            color={totals.net >= 0 ? palette.income : palette.expense}
            bg={palette.surface}
            border={palette.border}
            textColor={palette.text}
            mutedColor={palette.textMuted}
          />
        </View>

        {/* Mini donut card */}
        {hasRangeExpense ? (
          <Pressable
            onPress={() => router.push('/breakdown')}
            style={[
              styles.donutCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <View style={styles.donutCardLeft}>
              <DonutChart
                data={breakdownForRange(range, 'expense')}
                size={110}
                strokeWidth={14}
                centerLabel="SPENT"
                centerValue={moneyCompact(totals.expense, currencySymbol)}
                centerLabelColor={palette.textMuted}
                centerValueColor={palette.text}
                trackColor={palette.divider}
              />
            </View>

            <View style={styles.donutCardRight}>
              <Text
                style={[type.bodyStrong, { color: palette.text }]}
                numberOfLines={1}
              >
                Where it went
              </Text>
              {expenseBreakdown.map((b) => (
                <View key={b.categoryId} style={styles.miniLegendRow}>
                  <View
                    style={[styles.miniDot, { backgroundColor: b.color }]}
                  />
                  <Text
                    style={[
                      type.caption,
                      { color: palette.textMuted, flex: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {b.emoji} {b.name}
                  </Text>
                  <Text style={[type.caption, { color: palette.text }]}>
                    {(b.share * 100).toFixed(0)}%
                  </Text>
                </View>
              ))}
              <Text
                style={[
                  type.caption,
                  { color: palette.primary, marginTop: spacing.xs },
                ]}
              >
                See all →
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* Recent */}
        <View style={styles.sectionHead}>
          <Text style={[type.h3, { color: palette.text }]}>Recent</Text>
          <Text style={[type.caption, { color: palette.textMuted }]}>
            {inRange.length} in range
          </Text>
        </View>

        {!ready ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text style={[type.body, { color: palette.textMuted }]}>
              Loading…
            </Text>
          </View>
        ) : recent.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <Text style={styles.emptyEmoji}>{hasAny ? '🗓️' : '🌱'}</Text>
            <Text
              style={[
                type.bodyStrong,
                { color: palette.text, marginTop: spacing.sm },
              ]}
            >
              {hasAny ? 'Nothing in this range' : 'No transactions yet'}
            </Text>
            <Text
              style={[
                type.caption,
                {
                  color: palette.textMuted,
                  marginTop: spacing.xs,
                  textAlign: 'center',
                },
              ]}
            >
              {hasAny
                ? 'Try switching to Week or Month above.'
                : 'Tap the + button below to add your first one.'}
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.list,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            {recent.map((t, idx) => (
              <TransactionRow
                key={t.id}
                tx={t}
                isLast={idx === recent.length - 1}
                currencySymbol={currencySymbol}
                palette={palette}
                categoryLabel={getCategory(t.categoryId)?.name ?? 'Unknown'}
                categoryEmoji={getCategory(t.categoryId)?.emoji ?? '❓'}
                categoryColor={getCategory(t.categoryId)?.color ?? palette.textMuted}
                onPress={() => router.push(`/transaction/${t.id}`)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* FAB */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.fabWrap,
          { transform: [{ translateY: fabTranslateY }] },
        ]}
      >
        <Pressable
          onPress={() => router.push('/add')}
          style={[
            styles.fab,
            {
              backgroundColor: palette.primary,
              shadowColor: palette.primaryDark,
            },
          ]}
          accessibilityLabel="Add transaction"
        >
          <Text style={styles.fabPlus}>＋</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

function TotalCard({
  label,
  value,
  color,
  bg,
  border,
  textColor,
  mutedColor,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
  border: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View
      style={[
        styles.totalCard,
        { backgroundColor: bg, borderColor: border },
      ]}
    >
      <View style={[styles.totalDot, { backgroundColor: color }]} />
      <Text style={[styles.totalLabel, { color: mutedColor }]}>{label}</Text>
      <Text
        style={[styles.totalValue, { color: textColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function TransactionRow({
  tx,
  isLast,
  currencySymbol,
  palette,
  categoryLabel,
  categoryEmoji,
  categoryColor,
  onPress,
}: {
  tx: Transaction;
  isLast: boolean;
  currencySymbol: string;
  palette: ReturnType<typeof useTheme>['palette'];
  categoryLabel: string;
  categoryEmoji: string;
  categoryColor: string;
  onPress: () => void;
}) {
  const isIncome = tx.kind === 'income';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: palette.divider,
        },
        pressed && { backgroundColor: palette.surfaceAlt },
      ]}
    >
      <View
        style={[
          styles.rowEmojiWrap,
          { backgroundColor: categoryColor + '22' },
        ]}
      >
        <Text style={styles.rowEmoji}>{categoryEmoji}</Text>
      </View>

      <View style={styles.rowMid}>
        <Text
          style={[type.bodyStrong, { color: palette.text }]}
          numberOfLines={1}
        >
          {tx.note?.trim() || categoryLabel}
        </Text>
        <Text
          style={[type.caption, { color: palette.textMuted, marginTop: 2 }]}
          numberOfLines={1}
        >
          {categoryLabel} · {formatRelativeDay(tx.date)}
        </Text>
      </View>

      <Text
        style={[
          styles.rowAmount,
          { color: isIncome ? palette.income : palette.expense },
        ]}
        numberOfLines={1}
      >
        {isIncome ? '+' : '−'}
        {moneyCompact(tx.amount, currencySymbol)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  header: { marginBottom: spacing.lg },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  brand: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 3,
  },
  dateStamp: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 2,
  },
  dayHero: {
    fontFamily: fonts.serifBold,
    fontSize: 30,
    lineHeight: 36,
    marginTop: spacing.xs,
  },

  balanceCard: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  balanceLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 2,
  },
  balanceValue: {
    fontFamily: fonts.serifBold,
    fontSize: 34,
    lineHeight: 40,
    marginTop: spacing.sm,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  balanceCell: { flex: 1 },
  balanceDivider: {
    width: StyleSheet.hairlineWidth,
    height: 34,
    marginHorizontal: spacing.md,
  },
  balanceCellLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  balanceCellValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    marginTop: 2,
  },

  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.lg,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  segmentLabel: { fontSize: 13.5, letterSpacing: 0.3 },

  totalsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  totalCard: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 78,
    justifyContent: 'space-between',
  },
  totalDot: { width: 8, height: 8, borderRadius: 4, marginBottom: spacing.xs },
  totalLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11.5,
    letterSpacing: 0.4,
  },
  totalValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14.5,
    marginTop: 2,
  },

  donutCard: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  donutCardLeft: { marginRight: spacing.md },
  donutCardRight: { flex: 1 },
  miniLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  miniDot: { width: 8, height: 8, borderRadius: 4 },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },

  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyEmoji: { fontSize: 34 },

  list: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowEmojiWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowEmoji: { fontSize: 20 },
  rowMid: { flex: 1, marginRight: spacing.sm },
  rowAmount: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    flexShrink: 0,
  },

  fabWrap: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabPlus: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 32,
    fontFamily: fonts.sansRegular,
    marginTop: -3,
  },
});