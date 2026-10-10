// src/utils/csv.ts
// CSV export for Lumo Expense.
//
// NOTE: expo-file-system's classic API (cacheDirectory, writeAsStringAsync)
// now lives under `expo-file-system/legacy` in newer SDKs. Importing from
// the legacy subpath keeps the old, well-tested behavior and gives us the
// cache directory we need for the temp file.

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { Category, Transaction } from '../types';

// ─── CSV string builder ─────────────────────────────────────

const HEADERS = [
  'Date',
  'Type',
  'Amount',
  'Category',
  'Note',
  'Source',
] as const;

function escapeCsv(value: string): string {
  const needsQuotes = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function csvCell(v: string | number): string {
  return escapeCsv(String(v));
}

export function buildCsv(
  transactions: Transaction[],
  categories: Category[]
): string {
  const catById = new Map(categories.map((c) => [c.id, c]));

  const sorted = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.createdAt - a.createdAt;
  });

  const lines: string[] = [HEADERS.map(csvCell).join(',')];

  for (const t of sorted) {
    const cat = catById.get(t.categoryId);
    const row = [
      t.date,
      t.kind,
      t.amount.toFixed(2),
      cat?.name ?? 'Unknown',
      t.note ?? '',
      t.source,
    ];
    lines.push(row.map(csvCell).join(','));
  }

  return lines.join('\r\n');
}

// ─── File + share ───────────────────────────────────────────

export async function exportCsvAndShare(
  transactions: Transaction[],
  categories: Category[],
  filenameBase = 'lumo-expense'
): Promise<string | null> {
  if (transactions.length === 0) {
    throw new Error('No transactions to export');
  }

  const csv = buildCsv(transactions, categories);
  const BOM = '\uFEFF';
  const contents = BOM + csv;

  const filename = `${filenameBase}-${timestampForFilename()}.csv`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(uri, contents, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export Lumo Expense',
    UTI: 'public.comma-separated-values-text',
  });

  return uri;
}

// ─── Helpers ────────────────────────────────────────────────

function timestampForFilename(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}${m}${day}-${hh}${mm}`;
}