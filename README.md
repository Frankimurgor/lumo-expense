# Lumo Expense

**Offline-first personal finance tracker.** No accounts, no cloud, no tracking.

A [Lumo Labs](https://github.com/Frankimurgor) app.

---

## What it does

- **Add income and expenses** with categories, custom notes, and quick-date chips
- **Day / Week / Month totals** with a range-aware balance card
- **Pie chart breakdown** of where your money went, per category
- **Recurring transactions** — daily, weekly, or monthly, auto-materialized on app open
- **CSV export** — share a spreadsheet of every transaction via the native share sheet
- **PIN lock** — 4-digit code, SHA-256 hashed, never stored in plaintext
- **Dark mode** — system / light / dark, respects your OS preference
- **100% offline** — everything lives in AsyncStorage on your device

---

## Tech stack

- React Native + **Expo SDK 57**
- **Expo Router** (file-based routing with tabs + modal presentations)
- **TypeScript** throughout
- **AsyncStorage** for persistence
- **Context + Provider** pattern for state (`src/context/ExpenseContext.tsx`)
- **@expo-google-fonts** — Playfair Display (headings) + Inter (body)
- **react-native-svg** for the donut chart
- **expo-crypto** for PIN hashing
- **expo-file-system** + **expo-sharing** for CSV export

---

## Brand

| Token | Value |
|---|---|
| Navy (primary) | `#1A237E` |
| Navy dark | `#0D1259` |
| Cream (background) | `#F5EFE0` |
| Gold accent | `#B8860B` |
| Income green | `#2E7D32` |
| Expense red | `#C62828` |

Fonts: Playfair Display (serif, headings) · Inter (sans, body)

---

## Project structure
