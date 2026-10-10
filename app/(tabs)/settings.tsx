// app/(tabs)/settings.tsx
// Settings hub.

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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

import { useExpenses } from '../../src/context/ExpenseContext';
import { fonts, radius, spacing, type, useTheme } from '../../src/theme';
import type { CurrencyCode } from '../../src/types';
import { exportCsvAndShare } from '../../src/utils/csv';

const CURRENCY_LABEL: Record<CurrencyCode, string> = {
  KES: 'Kenyan Shilling (KSh)',
  USD: 'US Dollar ($)',
  EUR: 'Euro (€)',
  GBP: 'British Pound (£)',
  NGN: 'Nigerian Naira (₦)',
  ZAR: 'South African Rand (R)',
};

export default function Settings() {
  const { palette, preference, cyclePreference } = useTheme();
  const router = useRouter();
  const {
    settings,
    updateSettings,
    wipeAllData,
    transactions,
    categories,
    recurringRules,
  } = useExpenses();

  const [exporting, setExporting] = useState(false);

  const handleThemePress = () => cyclePreference();

  const themeLabel =
    preference === 'system'
      ? 'Follow system'
      : preference === 'light'
      ? 'Light'
      : 'Dark';

  const handleCurrencyPress = () => {
    const codes: CurrencyCode[] = ['KES', 'USD', 'EUR', 'GBP', 'NGN', 'ZAR'];
    Alert.alert(
      'Currency',
      'Choose the currency symbol shown throughout the app.',
      [
        ...codes.map((code) => ({
          text: code === settings.currency ? `${code} ✓` : code,
          onPress: () => updateSettings({ currency: code }),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  const handleWipe = () => {
    Alert.alert(
      'Erase all data?',
      `This will delete ${transactions.length} transaction${
        transactions.length === 1 ? '' : 's'
      }, all recurring rules, and reset settings. Cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: async () => {
            await wipeAllData();
            Alert.alert('Done', 'All Lumo Expense data was erased.');
          },
        },
      ]
    );
  };

  const handlePinPress = () => {
    if (settings.pinHash) {
      Alert.alert('PIN lock', 'PIN is currently enabled.', [
        {
          text: 'Change PIN',
          onPress: () => router.push('/lock?mode=change'),
        },
        {
          text: 'Remove PIN',
          style: 'destructive',
          onPress: () => router.push('/lock?mode=remove'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      router.push('/lock?mode=set');
    }
  };

  const handleExportPress = async () => {
    if (transactions.length === 0) {
      Alert.alert('Nothing to export', 'Add at least one transaction first.');
      return;
    }
    if (exporting) return;
    setExporting(true);
    try {
      await exportCsvAndShare(transactions, categories, 'lumo-expense');
    } catch (e) {
      Alert.alert('Export failed', String(e));
    } finally {
      setExporting(false);
    }
  };

  const recurringCount = recurringRules.length;
  const recurringEnabled = recurringRules.filter((r) => r.enabled).length;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.background }]}
      edges={['top']}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.brand, { color: palette.textMuted }]}>
            LUMO EXPENSE
          </Text>
          <Text style={[type.h2, { color: palette.text, marginTop: spacing.xs }]}>
            Settings
          </Text>
        </View>

        <SectionLabel label="APPEARANCE" palette={palette} />
        <Group palette={palette}>
          <Row
            palette={palette}
            emoji="🌓"
            title="Theme"
            subtitle={themeLabel}
            onPress={handleThemePress}
          />
          <Divider palette={palette} />
          <RowSwitch
            palette={palette}
            emoji="💵"
            title="Show balance on Home"
            subtitle="Toggle the big monthly NET card"
            value={settings.showBalance}
            onChange={(v) => updateSettings({ showBalance: v })}
          />
        </Group>

        <SectionLabel label="MONEY" palette={palette} />
        <Group palette={palette}>
          <Row
            palette={palette}
            emoji="💱"
            title="Currency"
            subtitle={CURRENCY_LABEL[settings.currency]}
            onPress={handleCurrencyPress}
          />
        </Group>

        <SectionLabel label="ORGANIZE" palette={palette} />
        <Group palette={palette}>
          <Row
            palette={palette}
            emoji="🏷️"
            title="Categories"
            subtitle={`${categories.length} total — tap to manage`}
            onPress={() => router.push('/categories')}
          />
          <Divider palette={palette} />
          <Row
            palette={palette}
            emoji="🔁"
            title="Recurring rules"
            subtitle={
              recurringCount === 0
                ? 'No rules yet — create one from a transaction'
                : `${recurringEnabled} of ${recurringCount} enabled`
            }
            onPress={() => router.push('/recurring')}
          />
        </Group>

        <SectionLabel label="DATA" palette={palette} />
        <Group palette={palette}>
          <Row
            palette={palette}
            emoji="📤"
            title={exporting ? 'Exporting…' : 'Export CSV'}
            subtitle={`${transactions.length} transaction${
              transactions.length === 1 ? '' : 's'
            } ready to share`}
            onPress={handleExportPress}
          />
          <Divider palette={palette} />
          <Row
            palette={palette}
            emoji="🔐"
            title="PIN lock"
            subtitle={
              settings.pinHash
                ? 'Enabled — tap to change or remove'
                : 'Disabled — tap to set up'
            }
            onPress={handlePinPress}
          />
        </Group>

        <SectionLabel label="DANGER ZONE" palette={palette} />
        <Group palette={palette}>
          <Row
            palette={palette}
            emoji="🗑️"
            title="Erase all data"
            subtitle={`${transactions.length} transaction${
              transactions.length === 1 ? '' : 's'
            } stored`}
            onPress={handleWipe}
            danger
          />
        </Group>

        <View style={styles.footer}>
          <Text
            style={[
              type.caption,
              { color: palette.textMuted, textAlign: 'center' },
            ]}
          >
            Lumo Expense · v1.0.0
          </Text>
          <Text
            style={[
              type.caption,
              { color: palette.textMuted, textAlign: 'center', marginTop: 2 },
            ]}
          >
            A Lumo Labs app · Offline-first, no accounts
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({
  label,
  palette,
}: {
  label: string;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  return (
    <Text
      style={[
        styles.sectionLabel,
        { color: palette.textMuted, marginTop: spacing.xl },
      ]}
    >
      {label}
    </Text>
  );
}

function Group({
  children,
  palette,
}: {
  children: React.ReactNode;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  return (
    <View
      style={[
        styles.group,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      {children}
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

function Row({
  palette,
  emoji,
  title,
  subtitle,
  onPress,
  danger,
}: {
  palette: ReturnType<typeof useTheme>['palette'];
  emoji: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: palette.surfaceAlt },
      ]}
    >
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            type.bodyStrong,
            { color: danger ? palette.expense : palette.text },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[type.caption, { color: palette.textMuted, marginTop: 2 }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.chev,
          { color: danger ? palette.expense : palette.textMuted },
        ]}
      >
        ›
      </Text>
    </Pressable>
  );
}

function RowSwitch({
  palette,
  emoji,
  title,
  subtitle,
  value,
  onChange,
}: {
  palette: ReturnType<typeof useTheme>['palette'];
  emoji: string;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: palette.text }]}>{title}</Text>
        {subtitle ? (
          <Text
            style={[type.caption, { color: palette.textMuted, marginTop: 2 }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: palette.divider, true: palette.primary + '88' }}
        thumbColor={value ? palette.primary : palette.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },

  header: { marginBottom: spacing.lg },
  brand: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 3,
  },

  sectionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },

  group: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowEmoji: { fontSize: 20 },
  chev: { fontFamily: fonts.sansRegular, fontSize: 22, lineHeight: 24 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.xl + spacing.md,
  },

  footer: { marginTop: spacing.xl },
});