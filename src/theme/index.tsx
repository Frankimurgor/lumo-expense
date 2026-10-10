// src/theme/index.ts
// Lumo Expense — brand theme, fonts, and dark mode context.
// Single source of truth for colors + typography across the app.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

// ─────────────────────────────────────────────────────────────
// Brand constants
// ─────────────────────────────────────────────────────────────

export const BRAND = {
  navy: '#1A237E',
  navyDark: '#0D1259',
  navyLight: '#3949AB',
  cream: '#F5EFE0',
  creamDark: '#E8DFC8',
} as const;

// Semantic colors used for money in/out and category accents
export const ACCENTS = {
  income: '#2E7D32', // green
  expense: '#C62828', // red
  warning: '#EF6C00', // orange
  info: '#0277BD', // blue
} as const;

// ─────────────────────────────────────────────────────────────
// Palette shapes
// ─────────────────────────────────────────────────────────────

export type Palette = {
  // Surfaces
  background: string;
  surface: string;
  surfaceAlt: string;
  card: string;

  // Text
  text: string;
  textMuted: string;
  textInverse: string;

  // Brand
  primary: string;
  primaryDark: string;
  primaryLight: string;
  onPrimary: string;
  accent: string;

  // Lines
  border: string;
  divider: string;

  // Semantic
  income: string;
  expense: string;
  warning: string;
  info: string;

  // Status bar content
  statusBar: 'light' | 'dark';
};

export const lightPalette: Palette = {
  background: BRAND.cream,
  surface: '#FFFFFF',
  surfaceAlt: '#FBF7EC',
  card: '#FFFFFF',

  text: '#1A1A1A',
  textMuted: '#5C5C66',
  textInverse: '#FFFFFF',

  primary: BRAND.navy,
  primaryDark: BRAND.navyDark,
  primaryLight: BRAND.navyLight,
  onPrimary: '#FFFFFF',
  accent: '#B8860B', // deep gold for subtle highlights on cream

  border: '#E0D8C2',
  divider: '#EAE2CC',

  income: ACCENTS.income,
  expense: ACCENTS.expense,
  warning: ACCENTS.warning,
  info: ACCENTS.info,

  statusBar: 'dark',
};

export const darkPalette: Palette = {
  background: '#0E1020',
  surface: '#171A2E',
  surfaceAlt: '#1E2238',
  card: '#1A1D33',

  text: '#F5EFE0',
  textMuted: '#A8A8B3',
  textInverse: '#0E1020',

  primary: BRAND.navyLight,
  primaryDark: BRAND.navy,
  primaryLight: '#5C6BC0',
  onPrimary: '#FFFFFF',
  accent: '#D4AF37', // brighter gold on dark

  border: '#2A2E48',
  divider: '#232741',

  income: '#66BB6A',
  expense: '#EF5350',
  warning: '#FFA726',
  info: '#42A5F5',

  statusBar: 'light',
};

// ─────────────────────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────────────────────

export const fonts = {
  // Serif — headings
  serifRegular: 'PlayfairDisplay_400Regular',
  serifMedium: 'PlayfairDisplay_500Medium',
  serifSemiBold: 'PlayfairDisplay_600SemiBold',
  serifBold: 'PlayfairDisplay_700Bold',

  // Sans — body
  sansRegular: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',

  // Fallbacks (system) if a font hasn't loaded yet
  fallbackSerif: 'serif',
  fallbackSans: 'System',
} as const;

// Pass this array straight into useFonts() in the root layout
export const fontAssets = {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} as const;

// Reusable text styles (screens spread these into StyleSheet entries)
export const type = {
  h1: { fontFamily: fonts.serifBold, fontSize: 34, lineHeight: 40, letterSpacing: 0.2 },
  h2: { fontFamily: fonts.serifSemiBold, fontSize: 26, lineHeight: 32, letterSpacing: 0.2 },
  h3: { fontFamily: fonts.serifMedium, fontSize: 20, lineHeight: 26 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.sansRegular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.sansRegular, fontSize: 12.5, lineHeight: 17 },
  label: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18, letterSpacing: 0.3 },
  mono: { fontFamily: fonts.sansMedium, fontSize: 15, letterSpacing: 0.5 },
} as const;

// ─────────────────────────────────────────────────────────────
// Dark mode preference: 'system' | 'light' | 'dark'
// ─────────────────────────────────────────────────────────────

export type DarkModePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = '@lumo_expense/dark_mode_pref';

type ThemeContextValue = {
  /** Resolved palette — screens use this everywhere. */
  palette: Palette;
  /** Whether the currently active palette is dark. */
  isDark: boolean;
  /** User preference (may be 'system'). */
  preference: DarkModePreference;
  /** Change preference; persists to AsyncStorage. */
  setPreference: (p: DarkModePreference) => void;
  /** Convenience: cycle system → light → dark → system. */
  cyclePreference: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [preference, setPreferenceState] =
    useState<DarkModePreference>('system');
  const [hydrated, setHydrated] = useState(false);

  // Load saved preference once
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'system' || saved === 'light' || saved === 'dark') {
          setPreferenceState(saved);
        }
      } catch {
        // ignore — default to 'system'
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setPreference = useCallback((p: DarkModePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const cyclePreference = useCallback(() => {
    setPreference(
      preference === 'system'
        ? 'light'
        : preference === 'light'
        ? 'dark'
        : 'system'
    );
  }, [preference, setPreference]);

  const isDark = useMemo(() => {
    if (preference === 'dark') return true;
    if (preference === 'light') return false;
    return systemScheme === 'dark';
  }, [preference, systemScheme]);

  const palette = isDark ? darkPalette : lightPalette;

  const value = useMemo<ThemeContextValue>(
    () => ({
      palette,
      isDark,
      preference,
      setPreference,
      cyclePreference,
    }),
    [palette, isDark, preference, setPreference, cyclePreference]
  );

  // Avoid flash of wrong theme on very first frame
  if (!hydrated) return null;

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
};

// ─────────────────────────────────────────────────────────────
// Spacing + radius tokens
// ─────────────────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;