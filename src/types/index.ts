// src/types/index.ts
// Lumo Expense — the whole data model in one place.
// Nothing in the app writes to storage without one of these shapes.

// ─────────────────────────────────────────────────────────────
// Money movement
// ─────────────────────────────────────────────────────────────

/** 'income' adds to balance, 'expense' subtracts. */
export type TransactionKind = 'income' | 'expense';

/** Where a transaction came from. Manual = user typed it. Recurring = auto-generated. */
export type TransactionSource = 'manual' | 'recurring';

export type Transaction = {
  /** Stable unique id (uuid-ish, generated on device). */
  id: string;
  /** Income or expense. */
  kind: TransactionKind;
  /** Positive amount in the user's currency. Sign is derived from `kind`. */
  amount: number;
  /** Category id — must match a Category.id in the categories list. */
  categoryId: string;
  /** Optional short note. Max ~120 chars, not enforced here. */
  note?: string;
  /**
   * ISO date string for the transaction date (YYYY-MM-DD).
   * We store date-only, not time — daily totals group by this.
   */
  date: string;
  /** Where it came from. */
  source: TransactionSource;
  /** If source === 'recurring', the id of the rule that generated it. */
  recurringRuleId?: string;
  /** Epoch ms when the record was created on device. */
  createdAt: number;
  /** Epoch ms when last edited. Equal to createdAt on first save. */
  updatedAt: number;
};

// ─────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────

/**
 * Category groups used for filtering + color coding.
 * 'income' = salary, gift, refund, etc.
 * 'expense' = food, transport, bills, etc.
 */
export type CategoryGroup = 'income' | 'expense';

export type Category = {
  id: string;
  name: string;
  /** Which kind of transaction this category belongs to. */
  group: CategoryGroup;
  /** Emoji icon shown in lists — simple, cross-platform, no asset bundling. */
  emoji: string;
  /** Hex color used in the pie chart + category chips. */
  color: string;
  /** If true, user cannot delete this category (used for defaults). */
  builtin?: boolean;
};

// ─────────────────────────────────────────────────────────────
// Recurring rules
// ─────────────────────────────────────────────────────────────

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export type RecurringRule = {
  id: string;
  /** Template fields — same as a Transaction, minus the ones we generate. */
  kind: TransactionKind;
  amount: number;
  categoryId: string;
  note?: string;
  /** 'daily' | 'weekly' | 'monthly'. */
  frequency: RecurrenceFrequency;
  /**
   * ISO date (YYYY-MM-DD) of the next time this rule should fire.
   * After each materialization, we advance this forward.
   */
  nextRunDate: string;
  /** If false, the rule is paused and will not generate transactions. */
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

// ─────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────

/**
 * User's dark-mode preference. 'system' follows the OS.
 * (This mirrors DarkModePreference in src/theme, kept separate so
 * the settings slice of storage stays self-contained.)
 */
export type DarkModePreference = 'system' | 'light' | 'dark';

/** Currency symbol shown throughout the UI. */
export type CurrencyCode = 'KES' | 'USD' | 'EUR' | 'GBP' | 'NGN' | 'ZAR';

export type Settings = {
  /** PIN lock. If pinHash is undefined, PIN lock is OFF. */
  pinHash?: string;
  /** Salt used with pinHash. Present only when PIN is set. */
  pinSalt?: string;
  /** Auto-lock after N seconds in background. 0 = lock immediately on background. */
  pinLockAfterSeconds: number;
  /** Dark mode preference. */
  darkMode: DarkModePreference;
  /** Currency code + symbol. */
  currency: CurrencyCode;
  /** Optional monthly budget — used to show a progress bar on home. */
  monthlyBudget?: number;
  /** If true, show the running balance on home screen. */
  showBalance: boolean;
  /** Epoch ms of the last time we checked & ran recurring rules. */
  lastRecurringCheck?: number;
};

export const DEFAULT_SETTINGS: Settings = {
  pinLockAfterSeconds: 0,
  darkMode: 'system',
  currency: 'KES',
  showBalance: true,
};

// ─────────────────────────────────────────────────────────────
// UI-level aggregate types (not persisted directly)
// ─────────────────────────────────────────────────────────────

/** Rollup used by the daily/weekly/monthly totals cards. */
export type Totals = {
  income: number;
  expense: number;
  /** income - expense. Can be negative. */
  net: number;
};

/** One slice of the pie chart. */
export type CategoryBreakdownItem = {
  categoryId: string;
  name: string;
  emoji: string;
  color: string;
  amount: number;
  /** Fraction of the total (0–1). */
  share: number;
};

/** Range identifiers used by the home screen's segmented control. */
export type TimeRange = 'day' | 'week' | 'month';

// ─────────────────────────────────────────────────────────────
// CSV export
// ─────────────────────────────────────────────────────────────

export type CsvRow = {
  date: string;
  kind: TransactionKind;
  amount: number;
  category: string;
  note: string;
  source: TransactionSource;
};