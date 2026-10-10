// src/utils/pin.ts
// PIN hashing + verification. PINs are never stored in plaintext —
// we generate a random salt, hash `salt + pin` with SHA-256, and store
// the hex digest. Verification re-hashes and compares.

import * as Crypto from 'expo-crypto';

/** Length of the PIN. Fixed at 4 for Lumo Expense. */
export const PIN_LENGTH = 4;

/** Generate a random 16-byte salt, hex-encoded. */
export async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return bytesToHex(bytes);
}

/** SHA-256 of `salt + pin`, hex-encoded. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`
  );
}

/**
 * Verify a PIN against a stored hash + salt.
 * Always does the hash, even if the input length is wrong, so timing
 * doesn't leak PIN-length.
 */
export async function verifyPin(
  pin: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const got = await hashPin(pin, salt);
  return constantTimeEqual(got, expectedHash);
}

// ─── Helpers ────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Constant-time string compare. Prevents a hypothetical timing oracle
 * from revealing how many leading characters of the hash matched.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}