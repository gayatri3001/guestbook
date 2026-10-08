import { hashString } from '../lib/hash';

export { hashString };

/**
 * Deterministic per-entry visual variation (tape pattern, pin colour, …).
 *
 * These are presentation details derived from the entry id, so they're
 * stable across reloads and devices without being persisted.
 */
export function pick<T>(options: readonly T[], seed: number, salt = 0): T {
  return options[hashString(`${seed}:${salt}`) % options.length]!;
}

/** A value in [-1, 1) derived from the seed. */
export function signedUnit(seed: number, salt = 0): number {
  return (hashString(`${seed}:${salt}`) / 2 ** 32) * 2 - 1;
}
