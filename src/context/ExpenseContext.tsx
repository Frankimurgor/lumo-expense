// src/context/ExpenseContext.tsx
// Single source of truth for transactions, categories, recurring rules,
// and settings. Persists to AsyncStorage. Provides derived totals and
// breakdowns so screens never re-compute.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import type {
    Category,
    CategoryBreakdownItem,
    RecurringRule,
    Settings,
    TimeRange,
    Totals,
    Transaction,
    TransactionKind
} from '../types';
import { DEFAULT_SETTINGS } from '../types';
import {
    advanceFrequency,
    isWithin,
    rangeForDay,
    rangeForMonth,
    rangeForWeek,
    today,
    todayISO,
} from '../utils/date';
import { makeId } from '../utils/id';

// ─────────────────────────────────────────────────────────────
// Storage keys
// ─────────────────────────────────────────────────────────────

const K = {
  transactions: '@lumo_expense/transactions',
  categories: '@lumo_expense/categories',
  recurring: '@lumo_expense/recurring',
  settings: '@lumo_expense/settings',
  seeded: '@lumo_expense/seeded_v1',
} as const;

// ─────────────────────────────────────────────────────────────
// Default categories — seeded on first launch
// ─────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES: Category[] = [
  // Expenses
  { id: 'cat_food',      name: 'Food & Drink',   group: 'expense', emoji: '🍔', color: '#E57373', builtin: true },
  { id: 'cat_transport', name: 'Transport',      group: 'expense', emoji: '🚌', color: '#64B5F6', builtin: true },
  { id: 'cat_bills',     name: 'Bills & Utilities', group: 'expense', emoji: '💡', color: '#FFB74D', builtin: true },
  { id: 'cat_rent',      name: 'Rent',           group: 'expense', emoji: '🏠', color: '#A1887F', builtin: true },
  { id: 'cat_shopping',  name: 'Shopping',       group: 'expense', emoji: '🛍️', color: '#BA68C8', builtin: true },
  { id: 'cat_health',    name: 'Health',         group: 'expense', emoji: '💊', color: '#4DB6AC', builtin: true },
  { id: 'cat_airtime',   name: 'Airtime & Data', group: 'expense', emoji: '📱', color: '#7986CB', builtin: true },
  { id: 'cat_other_ex',  name: 'Other',          group: 'expense', emoji: '📦', color: '#90A4AE', builtin: true },
  // Income
  { id: 'cat_salary',    name: 'Salary',         group: 'income',  emoji: '💼', color: '#66BB6A', builtin: true },
  { id: 'cat_business',  name: 'Business',       group: 'income',  emoji: '📈', color: '#43A047', builtin: true },
  { id: 'cat_gift',      name: 'Gift',           group: 'income',  emoji: '🎁', color: '#26A69A', builtin: true },
  { id: 'cat_other_in',  name: 'Other',          group: 'income',  emoji: '💰', color: '#9CCC65', builtin: true },
];

// ─────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────

type ExpenseContextValue = {
  // Raw state
  transactions: Transaction[];
  categories: Category[];
  recurringRules: RecurringRule[];
  settings: Settings;
  ready: boolean;

  // Transactions
  addTransaction: (input: {
    kind: TransactionKind;
    amount: number;
    categoryId: string;
    note?: string;
    date: string;
  }) => Promise<Transaction>;
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  // Categories
  addCategory: (input: {
    name: string;
    group: 'income' | 'expense';
    emoji: string;
    color: string;
  }) => Promise<Category>;
  updateCategory: (id: string, patch: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  getCategory: (id: string) => Category | undefined;

  // Recurring
  addRecurring: (input: {
    kind: TransactionKind;
    amount: number;
    categoryId: string;
    note?: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    nextRunDate: string;
  }) => Promise<RecurringRule>;
  updateRecurring: (id: string, patch: Partial<RecurringRule>) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  toggleRecurring: (id: string) => Promise<void>;
  runDueRecurring: () => Promise<number>;

  // Settings
  updateSettings: (patch: Partial<Settings>) => Promise<void>;

  // Derived selectors
  totalsForRange: (kind: TimeRange) => Totals;
  transactionsInRange: (kind: TimeRange) => Transaction[];
  breakdownForRange: (
    kind: TimeRange,
    group: 'income' | 'expense'
  ) => CategoryBreakdownItem[];

  // Danger zone
  wipeAllData: () => Promise<void>;
};

const ExpenseContext = createContext<ExpenseContextValue | undefined>(undefined);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export const ExpenseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  // Prevent double-write on first hydration
  const hydrated = useRef(false);

  // ─── Boot: load everything from AsyncStorage ──────────────
  useEffect(() => {
    (async () => {
      try {
        const [rawT, rawC, rawR, rawS, rawSeeded] = await Promise.all([
          AsyncStorage.getItem(K.transactions),
          AsyncStorage.getItem(K.categories),
          AsyncStorage.getItem(K.recurring),
          AsyncStorage.getItem(K.settings),
          AsyncStorage.getItem(K.seeded),
        ]);

        const parsedT: Transaction[] = rawT ? JSON.parse(rawT) : [];
        const parsedC: Category[] = rawC ? JSON.parse(rawC) : [];
        const parsedR: RecurringRule[] = rawR ? JSON.parse(rawR) : [];
        const parsedS: Settings = rawS
          ? { ...DEFAULT_SETTINGS, ...JSON.parse(rawS) }
          : DEFAULT_SETTINGS;

        // Seed default categories exactly once
        let cats = parsedC;
        if (!rawSeeded) {
          cats = DEFAULT_CATEGORIES;
          await AsyncStorage.setItem(K.categories, JSON.stringify(cats));
          await AsyncStorage.setItem(K.seeded, '1');
        }

        setTransactions(parsedT);
        setCategories(cats);
        setRecurringRules(parsedR);
        setSettings(parsedS);
      } catch (e) {
        // On corrupt data, fall back to a clean slate but keep the app usable
        console.warn('[Lumo Expense] load failed, resetting', e);
        setCategories(DEFAULT_CATEGORIES);
        await AsyncStorage.setItem(
          K.categories,
          JSON.stringify(DEFAULT_CATEGORIES)
        );
      } finally {
        hydrated.current = true;
        setReady(true);
      }
    })();
  }, []);

  // ─── Persistence helpers ──────────────────────────────────
  const persist = useCallback(
    async (key: string, value: unknown) => {
      if (!hydrated.current) return;
      try {
        await AsyncStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.warn(`[Lumo Expense] persist ${key} failed`, e);
      }
    },
    []
  );

  const persistTransactions = useCallback(
    (next: Transaction[]) => persist(K.transactions, next),
    [persist]
  );
  const persistCategories = useCallback(
    (next: Category[]) => persist(K.categories, next),
    [persist]
  );
  const persistRecurring = useCallback(
    (next: RecurringRule[]) => persist(K.recurring, next),
    [persist]
  );
  const persistSettings = useCallback(
    (next: Settings) => persist(K.settings, next),
    [persist]
  );

  // ─── Transactions ─────────────────────────────────────────
  const addTransaction = useCallback<ExpenseContextValue['addTransaction']>(
    async (input) => {
      const now = Date.now();
      const tx: Transaction = {
        id: makeId('tx'),
        kind: input.kind,
        amount: input.amount,
        categoryId: input.categoryId,
        note: input.note?.trim() || undefined,
        date: input.date,
        source: 'manual',
        createdAt: now,
        updatedAt: now,
      };
      setTransactions((prev) => {
        const next = [tx, ...prev];
        persistTransactions(next);
        return next;
      });
      return tx;
    },
    [persistTransactions]
  );

  const updateTransaction = useCallback<
    ExpenseContextValue['updateTransaction']
  >(
    async (id, patch) => {
      setTransactions((prev) => {
        const next = prev.map((t) =>
          t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
        );
        persistTransactions(next);
        return next;
      });
    },
    [persistTransactions]
  );

  const deleteTransaction = useCallback<
    ExpenseContextValue['deleteTransaction']
  >(
    async (id) => {
      setTransactions((prev) => {
        const next = prev.filter((t) => t.id !== id);
        persistTransactions(next);
        return next;
      });
    },
    [persistTransactions]
  );

  // ─── Categories ───────────────────────────────────────────
  const addCategory = useCallback<ExpenseContextValue['addCategory']>(
    async (input) => {
      const cat: Category = {
        id: makeId('cat'),
        name: input.name.trim(),
        group: input.group,
        emoji: input.emoji || '🏷️',
        color: input.color || '#90A4AE',
      };
      setCategories((prev) => {
        const next = [...prev, cat];
        persistCategories(next);
        return next;
      });
      return cat;
    },
    [persistCategories]
  );

  const updateCategory = useCallback<ExpenseContextValue['updateCategory']>(
    async (id, patch) => {
      setCategories((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
        persistCategories(next);
        return next;
      });
    },
    [persistCategories]
  );

  const deleteCategory = useCallback<ExpenseContextValue['deleteCategory']>(
    async (id) => {
      setCategories((prev) => {
        const next = prev.filter((c) => c.id !== id);
        persistCategories(next);
        return next;
      });
    },
    [persistCategories]
  );

  const getCategory = useCallback<ExpenseContextValue['getCategory']>(
    (id) => categories.find((c) => c.id === id),
    [categories]
  );

  // ─── Recurring ────────────────────────────────────────────
  const addRecurring = useCallback<ExpenseContextValue['addRecurring']>(
    async (input) => {
      const now = Date.now();
      const rule: RecurringRule = {
        id: makeId('rec'),
        kind: input.kind,
        amount: input.amount,
        categoryId: input.categoryId,
        note: input.note?.trim() || undefined,
        frequency: input.frequency,
        nextRunDate: input.nextRunDate,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      };
      setRecurringRules((prev) => {
        const next = [rule, ...prev];
        persistRecurring(next);
        return next;
      });
      return rule;
    },
    [persistRecurring]
  );

  const updateRecurring = useCallback<ExpenseContextValue['updateRecurring']>(
    async (id, patch) => {
      setRecurringRules((prev) => {
        const next = prev.map((r) =>
          r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r
        );
        persistRecurring(next);
        return next;
      });
    },
    [persistRecurring]
  );

  const deleteRecurring = useCallback<ExpenseContextValue['deleteRecurring']>(
    async (id) => {
      setRecurringRules((prev) => {
        const next = prev.filter((r) => r.id !== id);
        persistRecurring(next);
        return next;
      });
    },
    [persistRecurring]
  );

  const toggleRecurring = useCallback<ExpenseContextValue['toggleRecurring']>(
    async (id) => {
      setRecurringRules((prev) => {
        const next = prev.map((r) =>
          r.id === id ? { ...r, enabled: !r.enabled, updatedAt: Date.now() } : r
        );
        persistRecurring(next);
        return next;
      });
    },
    [persistRecurring]
  );

  /**
   * Walk each enabled rule and materialize every transaction that's
   * due between its nextRunDate and today (inclusive). Advance the rule
   * forward one interval at a time so we don't skip cycles when the app
   * hasn't been opened in a while.
   *
   * Returns the number of transactions created.
   */
  const runDueRecurring = useCallback<
    ExpenseContextValue['runDueRecurring']
  >(async () => {
    const todayStr = todayISO();
    let createdCount = 0;
    const newTransactions: Transaction[] = [];
    const updatedRules: RecurringRule[] = [];

    for (const rule of recurringRules) {
      if (!rule.enabled) {
        updatedRules.push(rule);
        continue;
      }

      let cursor = rule.nextRunDate;
      let advanced = false;

      // Materialize every cycle that's due on or before today
      while (cursor <= todayStr) {
        const now = Date.now();
        newTransactions.push({
          id: makeId('tx'),
          kind: rule.kind,
          amount: rule.amount,
          categoryId: rule.categoryId,
          note: rule.note,
          date: cursor,
          source: 'recurring',
          recurringRuleId: rule.id,
          createdAt: now,
          updatedAt: now,
        });
        createdCount += 1;
        cursor = advanceFrequency(cursor, rule.frequency);
        advanced = true;

        // Safety: never loop more than 400 cycles in one call
        if (createdCount > 400) break;
      }

      updatedRules.push(
        advanced ? { ...rule, nextRunDate: cursor, updatedAt: Date.now() } : rule
      );
    }

    if (createdCount > 0) {
      setTransactions((prev) => {
        const next = [...newTransactions, ...prev];
        persistTransactions(next);
        return next;
      });
    }
    // Always write back rules so nextRunDate is current, even if nothing fired
    setRecurringRules(updatedRules);
    persistRecurring(updatedRules);

    setSettings((prev) => {
      const next = { ...prev, lastRecurringCheck: Date.now() };
      persistSettings(next);
      return next;
    });

    return createdCount;
  }, [recurringRules, persistTransactions, persistRecurring, persistSettings]);

  // ─── Settings ─────────────────────────────────────────────
  const updateSettings = useCallback<ExpenseContextValue['updateSettings']>(
    async (patch) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persistSettings(next);
        return next;
      });
    },
    [persistSettings]
  );

  // ─── Derived selectors ────────────────────────────────────
  const rangeFor = useCallback((kind: TimeRange) => {
    const t = today();
    if (kind === 'day') return rangeForDay(t);
    if (kind === 'week') return rangeForWeek(t);
    return rangeForMonth(t);
  }, []);

  const transactionsInRange = useCallback<
    ExpenseContextValue['transactionsInRange']
  >(
    (kind) => {
      const range = rangeFor(kind);
      return transactions.filter((t) => isWithin(t.date, range));
    },
    [transactions, rangeFor]
  );

  const totalsForRange = useCallback<ExpenseContextValue['totalsForRange']>(
    (kind) => {
      const list = transactionsInRange(kind);
      let income = 0;
      let expense = 0;
      for (const t of list) {
        if (t.kind === 'income') income += t.amount;
        else expense += t.amount;
      }
      return { income, expense, net: income - expense };
    },
    [transactionsInRange]
  );

  const breakdownForRange = useCallback<
    ExpenseContextValue['breakdownForRange']
  >(
    (kind, group) => {
      const list = transactionsInRange(kind).filter((t) => t.kind === group);
      const byCat = new Map<string, number>();
      for (const t of list) {
        byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
      }
      const total = Array.from(byCat.values()).reduce((a, b) => a + b, 0);
      const items: CategoryBreakdownItem[] = [];
      for (const [categoryId, amount] of byCat) {
        const cat = categories.find((c) => c.id === categoryId);
        items.push({
          categoryId,
          name: cat?.name ?? 'Unknown',
          emoji: cat?.emoji ?? '❓',
          color: cat?.color ?? '#90A4AE',
          amount,
          share: total > 0 ? amount / total : 0,
        });
      }
      items.sort((a, b) => b.amount - a.amount);
      return items;
    },
    [transactionsInRange, categories]
  );

  // ─── Danger zone ──────────────────────────────────────────
  const wipeAllData = useCallback(async () => {
    await AsyncStorage.multiRemove([
      K.transactions,
      K.recurring,
      K.categories,
      K.settings,
      K.seeded,
    ]);
    // Re-seed categories + fresh settings
    setTransactions([]);
    setRecurringRules([]);
    setCategories(DEFAULT_CATEGORIES);
    setSettings(DEFAULT_SETTINGS);
    await AsyncStorage.setItem(K.categories, JSON.stringify(DEFAULT_CATEGORIES));
    await AsyncStorage.setItem(K.seeded, '1');
  }, []);

  // ─── Value ────────────────────────────────────────────────
  const value = useMemo<ExpenseContextValue>(
    () => ({
      transactions,
      categories,
      recurringRules,
      settings,
      ready,

      addTransaction,
      updateTransaction,
      deleteTransaction,

      addCategory,
      updateCategory,
      deleteCategory,
      getCategory,

      addRecurring,
      updateRecurring,
      deleteRecurring,
      toggleRecurring,
      runDueRecurring,

      updateSettings,

      totalsForRange,
      transactionsInRange,
      breakdownForRange,

      wipeAllData,
    }),
    [
      transactions,
      categories,
      recurringRules,
      settings,
      ready,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addCategory,
      updateCategory,
      deleteCategory,
      getCategory,
      addRecurring,
      updateRecurring,
      deleteRecurring,
      toggleRecurring,
      runDueRecurring,
      updateSettings,
      totalsForRange,
      transactionsInRange,
      breakdownForRange,
      wipeAllData,
    ]
  );

  return (
    <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export const useExpenses = (): ExpenseContextValue => {
  const ctx = useContext(ExpenseContext);
  if (!ctx) {
    throw new Error('useExpenses must be used inside <ExpenseProvider>');
  }
  return ctx;
};