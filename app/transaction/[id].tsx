// app/transaction/[id].tsx
// Transaction detail. View amount, category, date, note.
// Actions: Edit (opens shared form), Delete, Make Recurring.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TransactionForm from '../../src/components/TransactionForm';
import { useExpenses } from '../../src/context/ExpenseContext';
import { fonts, radius, spacing, type, useTheme } from '../../src/theme';
import type { RecurrenceFrequency } from '../../src/types';
import { addDays, formatLong, toISODate } from '../../src/utils/date';

const CURRENCY_SYMBOL: Record<string, string> = {
  KES: 'KSh',
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  ZAR: 'R',
};

const FREQUENCIES: { label: string; value: RecurrenceFrequency }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { palette } = useTheme();
  const {
    transactions,
    getCategory,
    updateTransaction,
    deleteTransaction,
    addRecurring,
    settings,
  } = useExpenses();

  const [editing, setEditing] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [recurringFreq, setRecurringFreq] =
    useState<RecurrenceFrequency>('monthly');

  const tx = useMemo(
    () => transactions.find((t) => t.id === id),
    [transactions, id]
  );

  const currencySymbol =
    CURRENCY_SYMBOL[settings.currency] ?? settings.currency;

  if (!tx) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: palette.background }]}
        edges={['top']}
      >
        <View style={styles.notFound}>
          <Text style={[type.h3, { color: palette.text }]}>
            Transaction not found
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{ marginTop: spacing.lg }}
          >
            <Text style={[type.body, { color: palette.primary }]}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const cat = getCategory(tx.categoryId);
  const isIncome = tx.kind === 'income';

  // ── Edit mode ─────────────────────────────────────────────
  if (editing) {
    return (
      <TransactionForm
        mode="edit"
        initial={{
          kind: tx.kind,
          amount: tx.amount,
          categoryId: tx.categoryId,
          date: tx.date,
          note: tx.note,
        }}
        onSubmit={async (values) => {
          await updateTransaction(tx.id, values);
          setEditing(false);
        }}
      />
    );
  }

  // ── Actions ───────────────────────────────────────────────
  const handleDelete = () => {
    Alert.alert(
      'Delete transaction?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(tx.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleSaveRecurring = async () => {
    await addRecurring({
      kind: tx.kind,
      amount: tx.amount,
      categoryId: tx.categoryId,
      note: tx.note,
      frequency: recurringFreq,
      // First run = tomorrow, then advance per frequency
      nextRunDate: toISODate(addDays(new Date(), 1)),
    });
    setRecurringOpen(false);
    Alert.alert(
      'Recurring rule created',
      `Will repeat ${recurringFreq} starting tomorrow. Manage in Settings → Recurring.`
    );
  };

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
            Back
          </Text>
        </Pressable>
        <Text style={[type.title, { color: palette.text }]}>Details</Text>
        <Pressable
          onPress={() => setEditing(true)}
          hitSlop={12}
          style={styles.topBarBtn}
        >
          <Text
            style={[
              styles.topBarBtnText,
              { color: palette.primary, textAlign: 'right' },
            ]}
          >
            Edit
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View
            style={[
              styles.heroEmojiWrap,
              {
                backgroundColor: (cat?.color ?? palette.textMuted) + '22',
              },
            ]}
          >
            <Text style={styles.heroEmoji}>{cat?.emoji ?? '❓'}</Text>
          </View>
          <Text
            style={[
              type.h2,
              { color: palette.text, textAlign: 'center', marginTop: spacing.md },
            ]}
          >
            {tx.note?.trim() || cat?.name || 'Transaction'}
          </Text>
          <Text
            style={[
              type.caption,
              { color: palette.textMuted, marginTop: spacing.xs },
            ]}
          >
            {cat?.name ?? 'Unknown'} · {isIncome ? 'Income' : 'Expense'}
          </Text>

          <Text
            style={[
              styles.heroAmount,
              { color: isIncome ? palette.income : palette.expense },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {isIncome ? '+' : '−'}
            {currencySymbol} {tx.amount.toFixed(2)}
          </Text>
        </View>

        {/* Meta rows */}
        <View
          style={[
            styles.metaCard,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <MetaRow
            label="Date"
            value={formatLong(tx.date)}
            palette={palette}
          />
          <Divider palette={palette} />
          <MetaRow
            label="Source"
            value={tx.source === 'recurring' ? 'Recurring' : 'Manual'}
            palette={palette}
          />
          {tx.note ? (
            <>
              <Divider palette={palette} />
              <MetaRow label="Note" value={tx.note} palette={palette} />
            </>
          ) : null}
        </View>

        {/* Actions */}
        <Pressable
          onPress={() => setRecurringOpen((v) => !v)}
          style={[
            styles.action,
            { borderColor: palette.border, backgroundColor: palette.surface },
          ]}
        >
          <Text style={[styles.actionEmoji]}>🔁</Text>
          <Text style={[styles.actionText, { color: palette.text }]}>
            Make this recurring
          </Text>
        </Pressable>

        {recurringOpen ? (
          <View
            style={[
              styles.recurringCard,
              { backgroundColor: palette.surfaceAlt, borderColor: palette.border },
            ]}
          >
            <Text
              style={[
                type.caption,
                { color: palette.textMuted, marginBottom: spacing.sm },
              ]}
            >
              Repeat this transaction every:
            </Text>
            <View style={styles.chipsWrap}>
              {FREQUENCIES.map((f) => {
                const active = f.value === recurringFreq;
                return (
                  <Pressable
                    key={f.value}
                    onPress={() => setRecurringFreq(f.value)}
                    style={[
                      styles.freqChip,
                      {
                        backgroundColor: active
                          ? palette.primary + '20'
                          : palette.surface,
                        borderColor: active ? palette.primary : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.freqChipText,
                        {
                          color: active ? palette.text : palette.textMuted,
                          fontFamily: active
                            ? fonts.sansSemiBold
                            : fonts.sansMedium,
                        },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={handleSaveRecurring}
              style={[
                styles.primaryBtn,
                { backgroundColor: palette.primary, marginTop: spacing.md },
              ]}
            >
              <Text style={styles.primaryBtnText}>Create rule</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={handleDelete}
          style={[
            styles.action,
            {
              borderColor: palette.expense + '55',
              backgroundColor: palette.surface,
              marginTop: spacing.sm,
            },
          ]}
        >
          <Text style={[styles.actionEmoji]}>🗑️</Text>
          <Text
            style={[styles.actionText, { color: palette.expense }]}
          >
            Delete transaction
          </Text>
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Small helpers ───────────────────────────────────────────

function MetaRow({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, { color: palette.textMuted }]}>
        {label}
      </Text>
      <Text
        style={[styles.metaValue, { color: palette.text }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function Divider({
  palette,
}: {
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  return (
    <View style={[styles.divider, { backgroundColor: palette.divider }]} />
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

  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },

  hero: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  heroEmojiWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 38 },
  heroAmount: {
    fontFamily: fonts.serifBold,
    fontSize: 44,
    lineHeight: 50,
    marginTop: spacing.lg,
    maxWidth: '90%',
  },

  metaCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  metaLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  metaValue: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    textAlign: 'right',
    flex: 1,
  },
  divider: { height: StyleSheet.hairlineWidth },

  action: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.lg,
  },
  actionEmoji: { fontSize: 18, marginRight: spacing.md },
  actionText: { fontFamily: fonts.sansMedium, fontSize: 15 },

  recurringCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  freqChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  freqChipText: { fontSize: 13.5 },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
  },
});