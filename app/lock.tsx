// app/lock.tsx
// Lock screen + PIN setup. Mode is driven by the `mode` route param:
//   - "unlock"  : enter PIN to continue (default)
//   - "set"     : first-time setup, enter + confirm
//   - "change"  : enter current PIN, then set a new one
//   - "remove"  : enter current PIN, then clear it

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useExpenses } from '../src/context/ExpenseContext';
import { fonts, radius, spacing, type, useTheme } from '../src/theme';
import {
    PIN_LENGTH,
    generateSalt,
    hashPin,
    verifyPin,
} from '../src/utils/pin';

type Mode = 'unlock' | 'set' | 'change' | 'remove';

export default function LockScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const { settings, updateSettings } = useExpenses();

  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: Mode =
    params.mode === 'set' ||
    params.mode === 'change' ||
    params.mode === 'remove'
      ? params.mode
      : 'unlock';

  // Stages within each mode:
  //   unlock  : [verify]
  //   set     : [new, confirm]
  //   change  : [current, new, confirm]
  //   remove  : [current]
  const [stage, setStage] = useState<'current' | 'new' | 'confirm'>(() =>
    mode === 'unlock' ? 'current' : mode === 'set' ? 'new' : 'current'
  );

  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const prompt = useMemo(() => {
    switch (mode) {
      case 'unlock':
        return 'Enter PIN';
      case 'set':
        return stage === 'new' ? 'Create a PIN' : 'Confirm PIN';
      case 'change':
        return stage === 'current'
          ? 'Enter current PIN'
          : stage === 'new'
          ? 'Create new PIN'
          : 'Confirm new PIN';
      case 'remove':
        return 'Enter current PIN';
    }
  }, [mode, stage]);

  const subPrompt = useMemo(() => {
    if (mode === 'unlock') return 'Unlock Lumo Expense';
    if (mode === 'set' && stage === 'new') return 'Choose 4 digits';
    if (mode === 'set' && stage === 'confirm') return 'One more time';
    if (mode === 'change' && stage === 'new') return 'Pick a new 4-digit code';
    if (mode === 'change' && stage === 'confirm') return 'Confirm the new code';
    if (mode === 'remove') return 'Verify to disable PIN lock';
    return '';
  }, [mode, stage]);

  // ─── Progress dots ─────────────────────────────────────
  const dots = useMemo(() => {
    return Array.from({ length: PIN_LENGTH }, (_, i) => i < pin.length);
  }, [pin]);

  // ─── Digit handlers ────────────────────────────────────
  const handleDigit = (d: string) => {
    if (busy) return;
    setError(null);
    setPin((prev) => (prev.length >= PIN_LENGTH ? prev : prev + d));
  };
  const handleBackspace = () => {
    if (busy) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  // Auto-submit when PIN reaches full length
  useEffect(() => {
    if (pin.length !== PIN_LENGTH || busy) return;
    (async () => {
      setBusy(true);
      try {
        await handleComplete(pin);
      } catch (e) {
        setError(String(e));
        setPin('');
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // ─── Complete logic per stage ──────────────────────────
  async function handleComplete(entered: string) {
    if (mode === 'unlock') {
      if (!settings.pinHash || !settings.pinSalt) {
        // No PIN stored — nothing to unlock
        router.replace('/(tabs)');
        return;
      }
      const ok = await verifyPin(entered, settings.pinSalt, settings.pinHash);
      if (!ok) {
        setError('Incorrect PIN');
        setPin('');
        return;
      }
      router.replace('/(tabs)');
      return;
    }

    if (mode === 'remove') {
      if (!settings.pinHash || !settings.pinSalt) {
        router.back();
        return;
      }
      const ok = await verifyPin(entered, settings.pinSalt, settings.pinHash);
      if (!ok) {
        setError('Incorrect PIN');
        setPin('');
        return;
      }
      await updateSettings({ pinHash: undefined, pinSalt: undefined });
      router.back();
      return;
    }

    if (mode === 'change' && stage === 'current') {
      if (!settings.pinHash || !settings.pinSalt) {
        // No PIN set — jump straight to new
        setStage('new');
        setPin('');
        return;
      }
      const ok = await verifyPin(entered, settings.pinSalt, settings.pinHash);
      if (!ok) {
        setError('Incorrect PIN');
        setPin('');
        return;
      }
      setStage('new');
      setPin('');
      return;
    }

    // Both 'set' and 'change' at stage 'new' or 'confirm'
    if (stage === 'new') {
      setNewPin(entered);
      setStage('confirm');
      setPin('');
      return;
    }

    // stage === 'confirm'
    if (entered !== newPin) {
      setError('PINs do not match');
      setPin('');
      setNewPin('');
      setStage('new');
      return;
    }
    const salt = await generateSalt();
    const hash = await hashPin(entered, salt);
    await updateSettings({ pinHash: hash, pinSalt: salt });
    router.back();
  }

  // ─── Cancel / back ─────────────────────────────────────
  const handleCancel = () => {
    if (mode === 'unlock') {
      // Can't cancel out of unlock — no escape
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: palette.background }]}
      edges={['top', 'bottom']}
    >
      {/* Optional back/cancel — hidden for unlock mode */}
      {mode !== 'unlock' ? (
        <View style={styles.topBar}>
          <Pressable onPress={handleCancel} hitSlop={12} style={styles.topBarBtn}>
            <Text style={[styles.topBarBtnText, { color: palette.textMuted }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.topBar} />
      )}

      {/* Brand + lock icon */}
      <View style={styles.header}>
        <View
          style={[
            styles.lockBadge,
            { backgroundColor: palette.primary + '18' },
          ]}
        >
          <Text style={styles.lockEmoji}>🔐</Text>
        </View>
        <Text
          style={[
            type.h2,
            {
              color: palette.text,
              textAlign: 'center',
              marginTop: spacing.md,
            },
          ]}
        >
          {prompt}
        </Text>
        {subPrompt ? (
          <Text
            style={[
              type.caption,
              {
                color: palette.textMuted,
                textAlign: 'center',
                marginTop: spacing.xs,
              },
            ]}
          >
            {subPrompt}
          </Text>
        ) : null}
      </View>

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {dots.map((filled, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: filled ? palette.primary : 'transparent',
                borderColor: filled ? palette.primary : palette.border,
              },
            ]}
          />
        ))}
      </View>

      {/* Error */}
      <View style={styles.errorSlot}>
        {error ? (
          <Text style={[type.caption, { color: palette.expense }]}>{error}</Text>
        ) : null}
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ].map((row, ri) => (
          <View key={ri} style={styles.keypadRow}>
            {row.map((key) => (
              <Pressable
                key={key}
                onPress={() => handleDigit(key)}
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
        <View style={styles.keypadRow}>
          <View style={styles.keySpacer} />
          <Pressable
            onPress={() => handleDigit('0')}
            style={({ pressed }) => [
              styles.key,
              {
                backgroundColor: pressed ? palette.surfaceAlt : palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <Text style={[styles.keyText, { color: palette.text }]}>0</Text>
          </Pressable>
          <Pressable
            onPress={handleBackspace}
            style={({ pressed }) => [
              styles.key,
              {
                backgroundColor: pressed ? palette.surfaceAlt : palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <Text style={[styles.keyText, { color: palette.text }]}>⌫</Text>
          </Pressable>
        </View>
      </View>

      {/* Bottom hint for unlock mode */}
      {mode === 'unlock' ? (
        <Text
          style={[
            type.caption,
            {
              color: palette.textMuted,
              textAlign: 'center',
              marginBottom: spacing.lg,
            },
          ]}
        >
          Offline · Your PIN never leaves this device
        </Text>
      ) : (
        <View style={{ height: spacing.lg }} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  topBar: {
    height: 44,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  topBarBtn: { alignSelf: 'flex-start' },
  topBarBtnText: { fontFamily: fonts.sansMedium, fontSize: 15 },

  header: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockEmoji: { fontSize: 28 },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },

  errorSlot: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },

  keypad: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  keySpacer: {
    flex: 1,
    marginHorizontal: 4,
  },
  key: {
    flex: 1,
    marginHorizontal: 4,
    height: 62,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 24,
  },
});