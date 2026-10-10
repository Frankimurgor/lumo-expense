// src/utils/money.ts
// Currency formatting for Lumo Expense.
//
//   money()         → full precision: "KSh 5,400.00"  (balance, detail)
//   moneyCompact()  → narrow:         "KSh 5,400"  or  "KSh 12.5K"  (rows, cards)
//
// Uses manual thousands-separation (regex) instead of toLocaleString so
// behavior is identical on every Hermes / Android build.

function withThousands(n: number, decimals: number): string {
  const fixed = n.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const intWithCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimals > 0 ? `${intWithCommas}.${decPart}` : intWithCommas;
}

/** Full precision: "KSh 5,400.00", or "−KSh 5,400.00" for negatives. */
export function money(n: number, symbol: string): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}${symbol} ${withThousands(Math.abs(n), 2)}`;
}

/**
 * Compact form for narrow surfaces.
 *   < 10,000          → "KSh 5,400"
 *   < 1,000,000       → "KSh 12.5K"
 *   < 1,000,000,000   → "KSh 1.2M"
 *   else              → "KSh 1.2B"
 */
export function moneyCompact(n: number, symbol: string): string {
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  let body: string;
  if (abs < 10_000) {
    body = withThousands(abs, 0);
  } else if (abs < 1_000_000) {
    body = `${(abs / 1000).toFixed(1)}K`;
  } else if (abs < 1_000_000_000) {
    body = `${(abs / 1_000_000).toFixed(1)}M`;
  } else {
    body = `${(abs / 1_000_000_000).toFixed(1)}B`;
  }
  return `${sign}${symbol} ${body}`;
}

/** Symbol lookup used app-wide. */
export const CURRENCY_SYMBOL: Record<string, string> = {
  KES: 'KSh',
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  ZAR: 'R',
};

/** Convenience: symbol for a currency code, with a safe fallback. */
export function symbolFor(code: string): string {
  return CURRENCY_SYMBOL[code] ?? code;
}