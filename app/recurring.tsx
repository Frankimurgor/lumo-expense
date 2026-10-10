// app/recurring.tsx
// Manage recurring rules — toggle, delete, see next run date.

import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useExpenses } from '../src/context/ExpenseContext';
import { fonts, radius, spacing, type, useTheme } from '../src/theme';
import type { RecurringRule } from '../src/types';
import { formatMedium, formatRelativeDay } from '../src/utils/date';

const CURRENCY_SYMBOL: Record<string, string> = {
  KES: 'KSh',
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  ZAR: 'R',
};

const FREQUENCY_LABEL: Record<RecurringRule['frequency'], string> = {
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
};

export default function RecurringManager() {
  const router = useRouter();
  const { palette } = useTheme();
  const {
    recurringRules,
    getCategory,
    settings,
    toggleRecurring,
    deleteRecurring,
    runDueRecurring,
  } = useExpenses();

  const currencySymbol =
    CURRENCY_SYMBOL[settings.currency] ?? settings.currency;

  // Sort: enabled first, then soonest nextRunDate
  const sorted = useMemo(() => {
    return [...recurringRules].sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.nextRunDate < b.nextRunDate ? -1 : 1;
    });
  }, [recurringRules]);

  const handleDelete = (rule: RecurringRule) => {
    const cat = getCategory(rule.categoryId);
    Alert.alert(
      'Delete recurring rule?',
      `"${rule.note || cat?.name || 'Recurring'}" will stop repeating. Past transactions stay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteRecurring(rule.id),
        },
      ]
    );
  };

  const handleRunNow = async () => {
    const created = await runDueRecurring();
    Alert.alert(
      'Recurring check',
      created === 0
        ? 'Nothing was due.'
        : `Created ${created} transaction${created === 1 ? '' : 's'}.`
    );
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.background }]}
      edges={['top', 'bottom']}
    >
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
        <Text style={[type.title, { color: palette.text }]}>Recurring</Text>
        <View style={styles.topBarBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[type.h2, { color: palette.text }]}>
            {recurringRules.length === 0
              ? 'No rules yet'
              : `${recurringRules.length} rule${
                  recurringRules.length === 1 ? '' : 's'
                }`}
          </Text>
          <Text
            style={[
              type.caption,
              { color: palette.textMuted, marginTop: spacing.xs },
            ]}
          >
            Rules auto-create transactions on their due date when you open
            the app.
          </Text>
        </View>

        {/* Manual run button */}
        <Pressable
          onPress={handleRunNow}
          style={[
            styles.runBtn,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
            },
          ]}
        >
          <Text style={styles.runEmoji}>⚡</Text>
          <Text style={[type.bodyStrong, { color: palette.text }]}>
            Check now
          </Text>
          <Text
            style={[
              type.caption,
              { color: palette.textMuted, marginTop: 2 },
            ]}
          >
            Materialize any rules that are due today or overdue.
          </Text>
        </Pressable>

        {/* Empty state */}
        {recurringRules.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <Text style={styles.emptyEmoji}>🔁</Text>
            <Text
              style={[
                type.bodyStrong,
                { color: palette.text, marginTop: spacing.sm },
              ]}
            >
              Nothing recurring yet
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
              Open a transaction and tap "Make this recurring" to create
              your first rule.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {sorted.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                palette={palette}
                currencySymbol={currencySymbol}
                categoryName={getCategory(rule.categoryId)?.name ?? 'Unknown'}
                categoryEmoji={getCategory(rule.categoryId)?.emoji ?? '❓'}
                categoryColor={
                  getCategory(rule.categoryId)?.color ?? palette.textMuted
                }
                onToggle={() => toggleRecurring(rule.id)}
                onDelete={() => handleDelete(rule)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Rule row ───────────────────────────────────────────────

function RuleRow({
  rule,
  palette,
  currencySymbol,
  categoryName,
  categoryEmoji,
  categoryColor,
  onToggle,
  onDelete,
}: {
  rule: RecurringRule;
  palette: ReturnType<typeof useTheme>['palette'];
  currencySymbol: string;
  categoryName: string;
  categoryEmoji: string;
  categoryColor: string;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isIncome = rule.kind === 'income';
  const dim = !rule.enabled;

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          opacity: dim ? 0.55 : 1,
        },
      ]}
    >
      {/* Top: emoji + label + switch */}
      <View style={styles.rowTop}>
        <View
          style={[
            styles.rowEmojiWrap,
            { backgroundColor: categoryColor + '22' },
          ]}
        >
          <Text style={styles.rowEmoji}>{categoryEmoji}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={[type.bodyStrong, { color: palette.text }]}
            numberOfLines={1}
          >
            {rule.note?.trim() || categoryName}
          </Text>
          <Text
            style={[type.caption, { color: palette.textMuted, marginTop: 2 }]}
            numberOfLines={1}
          >
            {categoryName} · {FREQUENCY_LABEL[rule.frequency]}
          </Text>
        </View>

        <Switch
          value={rule.enabled}
          onValueChange={onToggle}
          trackColor={{
            false: palette.divider,
            true: palette.primary + '88',
          }}
          thumbColor={rule.enabled ? palette.primary : palette.surface}
        />
      </View>

      {/* Bottom: amount + next run + delete */}
      <View
        style={[
          styles.rowBottom,
          { borderTopColor: palette.divider },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.amount,
              { color: isIncome ? palette.income : palette.expense },
            ]}
          >
            {isIncome ? '+' : '−'}
            {currencySymbol} {rule.amount.toFixed(2)}
          </Text>
          <Text
            style={[
              type.caption,
              { color: palette.textMuted, marginTop: 2 },
            ]}
          >
            Next: {formatRelativeDay(rule.nextRunDate)} ·{' '}
            {formatMedium(rule.nextRunDate)}
          </Text>
        </View>

        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={styles.deleteBtn}
        >
          <Text style={[styles.deleteText, { color: palette.expense }]}>
            Delete
          </Text>
        </Pressable>
      </View>
    </View>
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

  header: { marginBottom: spacing.lg },

  runBtn: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  runEmoji: { fontSize: 18, marginBottom: spacing.xs },

  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyEmoji: { fontSize: 34 },

  list: { gap: spacing.md },

  row: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowEmojiWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowEmoji: { fontSize: 20 },

  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  amount: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
  },
  deleteBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  deleteText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13.5,
  },
});