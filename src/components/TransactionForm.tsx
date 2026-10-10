// src/components/TransactionForm.tsx
// Shared form for Add + Edit. Keyboard-aware layout for Android.

import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useExpenses } from '../context/ExpenseContext';
import { fonts, radius, spacing, type, useTheme } from '../theme';
import type { TransactionKind } from '../types';
import {
  addDays,
  formatMedium,
  fromISODate,
  today,
  toISODate,
} from '../utils/date';

const CURRENCY_SYMBOL: Record<string, string> = {
  KES: 'KSh',
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  ZAR: 'R',
};

const QUICK_DATES = [
  { label: 'Today', offset: 0 },
  { label: 'Yesterday', offset: -1 },
  { label: '2 days ago', offset: -2 },
] as const;

export type TransactionFormInitial = {
  kind: TransactionKind;
  amount: number;
  categoryId: string | null;
  date: string;
  note?: string;
};

export type TransactionFormProps = {
  mode: 'add' | 'edit';
  initial?: Partial<TransactionFormInitial>;
  onSubmit: (values: {
    kind: TransactionKind;
    amount: number;
    categoryId: string;
    date: string;
    note?: string;
  }) => Promise<void> | void;
};

function offsetFromToday(iso: string): number | null {
  const t = today();
  const d = fromISODate(iso);
  const diff = Math.round((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function TransactionForm({
  mode,
  initial,
  onSubmit,
}: TransactionFormProps) {
  const router = useRouter();
  const { palette } = useTheme();
  const { categories, settings } = useExpenses();

  const currencySymbol =
    CURRENCY_SYMBOL[settings.currency] ?? settings.currency;

  const [kind, setKind] = useState<TransactionKind>(
    initial?.kind ?? 'expense'
  );
  const [amountText, setAmountText] = useState<string>(
    initial?.amount && initial.amount > 0 ? initial.amount.toFixed(2) : '0'
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    initial?.categoryId ?? null
  );

  const initialOffset = useMemo(() => {
    if (!initial?.date) return 0;
    const off = offsetFromToday(initial.date);
    return off === null ? 0 : off;
  }, [initial?.date]);

  const [dateOffset, setDateOffset] = useState<number>(initialOffset);
  const [customISO, setCustomISO] = useState<string | null>(null);

  const [note, setNote] = useState<string>(initial?.note ?? '');
  const [saving, setSaving] = useState(false);

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.group === kind),
    [categories, kind]
  );

  useEffect(() => {
    if (!categoryId || !visibleCategories.some((c) => c.id === categoryId)) {
      setCategoryId(visibleCategories[0]?.id ?? null);
    }
  }, [visibleCategories, categoryId]);

  useEffect(() => {
    if (initial?.date) {
      const off = offsetFromToday(initial.date);
      if (off !== null && off >= -2 && off <= 0) {
        setDateOffset(off);
        setCustomISO(null);
      } else {
        setCustomISO(initial.date);
      }
    }
  }, [initial?.date]);

  const handleDigit = (d: string) => {
    setAmountText((prev) => {
      if (prev === '0') return d;
      const [, decimals] = prev.split('.');
      if (decimals && decimals.length >= 2) return prev;
      if (prev.replace('.', '').length >= 10) return prev;
      return prev + d;
    });
  };
  const handleDot = () =>
    setAmountText((prev) => (prev.includes('.') ? prev : prev + '.'));
  const handleBackspace = () =>
    setAmountText((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));

  const amountValue = useMemo(() => {
    const n = parseFloat(amountText);
    return isFinite(n) && n > 0 ? n : 0;
  }, [amountText]);

  const canSave = amountValue > 0 && !!categoryId && !saving;

  const handleSave = async () => {
    if (!canSave || !categoryId) return;
    setSaving(true);
    try {
      const iso = customISO ?? toISODate(addDays(new Date(), dateOffset));
      await onSubmit({
        kind,
        amount: amountValue,
        categoryId,
        date: iso,
        note: note.trim() || undefined,
      });
    } catch (e) {
      Alert.alert('Could not save', String(e));
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode === 'add'
      ? `New ${kind === 'expense' ? 'Expense' : 'Income'}`
      : 'Edit Transaction';

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.background }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        // Android needs an explicit behavior — 'height' works reliably
        // with softwareKeyboardLayoutMode: "resize" in app.json.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.topBarBtn}
          >
            <Text style={[styles.topBarBtnText, { color: palette.textMuted }]}>
              Cancel
            </Text>
          </Pressable>
          <Text style={[type.title, { color: palette.text }]}>{title}</Text>
          <View style={styles.topBarBtn} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              // Big bottom padding gives the note room to scroll above
              // the keyboard when it slides up.
              paddingBottom: 320,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Kind toggle */}
          <View
            style={[
              styles.kindSegment,
              {
                backgroundColor: palette.surfaceAlt,
                borderColor: palette.border,
              },
            ]}
          >
            {(['expense', 'income'] as TransactionKind[]).map((k) => {
              const active = k === kind;
              const activeColor =
                k === 'expense' ? palette.expense : palette.income;
              return (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  style={[
                    styles.kindItem,
                    active && { backgroundColor: activeColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.kindLabel,
                      {
                        color: active ? '#FFFFFF' : palette.textMuted,
                        fontFamily: active
                          ? fonts.sansSemiBold
                          : fonts.sansMedium,
                      },
                    ]}
                  >
                    {k === 'expense' ? 'Expense' : 'Income'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Amount */}
          <View style={styles.amountWrap}>
            <Text
              style={[styles.amountCurrency, { color: palette.textMuted }]}
            >
              {currencySymbol}
            </Text>
            <Text
              style={[
                styles.amountValue,
                {
                  color: kind === 'expense' ? palette.expense : palette.income,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {amountText}
            </Text>
          </View>

          {/* Keypad */}
          <View style={styles.keypad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['.', '0', '⌫'],
            ].map((row, ri) => (
              <View key={ri} style={styles.keypadRow}>
                {row.map((key) => (
                  <Pressable
                    key={key}
                    onPress={() => {
                      if (key === '.') handleDot();
                      else if (key === '⌫') handleBackspace();
                      else handleDigit(key);
                    }}
                    style={({ pressed }) => [
                      styles.key,
                      {
                        backgroundColor: pressed
                          ? palette.surfaceAlt
                          : palette.surface,
                        borderColor: palette.border,
                      },
                    ]}
                  >
                    <Text style={[styles.keyText, { color: palette.text }]}>
                      {key}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          {/* Category chips */}
          <Text
            style={[
              styles.sectionLabel,
              { color: palette.textMuted, marginTop: spacing.xl },
            ]}
          >
            CATEGORY
          </Text>
          <View style={styles.chipsWrap}>
            {visibleCategories.map((c) => {
              const active = c.id === categoryId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? c.color + '22'
                        : palette.surface,
                      borderColor: active ? c.color : palette.border,
                    },
                  ]}
                >
                  <Text style={styles.chipEmoji}>{c.emoji}</Text>
                  <Text
                    style={[
                      styles.chipLabel,
                      {
                        color: active ? palette.text : palette.textMuted,
                        fontFamily: active
                          ? fonts.sansSemiBold
                          : fonts.sansMedium,
                      },
                    ]}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Date */}
          <Text
            style={[
              styles.sectionLabel,
              { color: palette.textMuted, marginTop: spacing.xl },
            ]}
          >
            DATE
          </Text>
          <View style={styles.chipsWrap}>
            {QUICK_DATES.map((q) => {
              const active = !customISO && q.offset === dateOffset;
              return (
                <Pressable
                  key={q.label}
                  onPress={() => {
                    setCustomISO(null);
                    setDateOffset(q.offset);
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? palette.primary + '18'
                        : palette.surface,
                      borderColor: active
                        ? palette.primary
                        : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      {
                        color: active ? palette.text : palette.textMuted,
                        fontFamily: active
                          ? fonts.sansSemiBold
                          : fonts.sansMedium,
                      },
                    ]}
                  >
                    {q.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text
            style={[
              type.caption,
              { color: palette.textMuted, marginTop: spacing.sm },
            ]}
          >
            {formatMedium(
              customISO ?? toISODate(addDays(new Date(), dateOffset))
            )}
          </Text>

          {/* Note */}
          <Text
            style={[
              styles.sectionLabel,
              { color: palette.textMuted, marginTop: spacing.xl },
            ]}
          >
            NOTE · OPTIONAL
          </Text>
          <TextInput
            value={note}
            onChangeText={(t) => setNote(t.slice(0, 120))}
            placeholder="What was it for?"
            placeholderTextColor={palette.textMuted}
            style={[
              styles.noteInput,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.text,
                fontFamily: fonts.sansRegular,
              },
            ]}
            maxLength={120}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
            blurOnSubmit
          />
        </ScrollView>

        {/* Save bar */}
        <View
          style={[
            styles.saveWrap,
            {
              backgroundColor: palette.background,
              borderTopColor: palette.divider,
            },
          ]}
        >
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={[
              styles.saveBtn,
              {
                backgroundColor: canSave
                  ? kind === 'expense'
                    ? palette.expense
                    : palette.income
                  : palette.surfaceAlt,
                opacity: canSave ? 1 : 0.6,
              },
            ]}
          >
            <Text
              style={[
                styles.saveBtnText,
                {
                  color: canSave ? '#FFFFFF' : palette.textMuted,
                  fontFamily: fonts.sansSemiBold,
                },
              ]}
            >
              {mode === 'add'
                ? `Save ${kind === 'expense' ? 'Expense' : 'Income'}`
                : 'Save Changes'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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

  scroll: { paddingHorizontal: spacing.lg },

  kindSegment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
  },
  kindItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  kindLabel: { fontSize: 14, letterSpacing: 0.3 },

  amountWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  amountCurrency: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 20,
    marginRight: spacing.sm,
  },
  amountValue: {
    fontFamily: fonts.serifBold,
    fontSize: 52,
    lineHeight: 58,
    maxWidth: '80%',
  },

  keypad: { marginTop: spacing.sm },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  key: {
    flex: 1,
    marginHorizontal: 4,
    height: 56,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontFamily: fonts.sansSemiBold, fontSize: 22 },

  sectionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipEmoji: { fontSize: 15, marginRight: 6 },
  chipLabel: { fontSize: 13.5 },

  noteInput: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
  },

  saveWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 16, letterSpacing: 0.3 },
});