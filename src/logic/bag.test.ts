import { describe, it, expect } from 'vitest';

import { PIECE_KINDS } from '../constants';
import type { PieceKind } from '../types';
import { createBag, drawFromBag } from './bag';

/**
 * Build a deterministic RNG that yields values from a fixed sequence.
 *
 * Values are floored to a number in `[0, 1)` and consumed in order.
 * Throws if the test exhausts the supplied sequence — that means the
 * test under-specified the RNG and should be fixed.
 */
function rngFromSequence(values: readonly number[]): () => number {
  let i = 0;
  return () => {
    if (i >= values.length) {
      throw new Error(`RNG sequence exhausted after ${values.length} draws`);
    }
    return values[i++];
  };
}

/**
 * A simple seeded mulberry32 RNG for "is this reproducible?" assertions.
 * Same seed → same sequence of numbers in `[0, 1)`.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('createBag', () => {
  it('returns an array of length 7 with exactly one of each PieceKind', () => {
    const bag = createBag();
    expect(bag).toHaveLength(7);
    expect([...bag].sort()).toEqual([...PIECE_KINDS].sort());
  });

  it('accepts an injected RNG and produces a deterministic permutation', () => {
    const a = createBag(mulberry32(42));
    const b = createBag(mulberry32(42));
    const c = createBag(mulberry32(43));
    expect(a).toEqual(b);
    // Different seed should (almost certainly) produce a different
    // permutation; if this fails on the chosen seeds it is a real bug
    // — the RNG is being ignored.
    expect(a).not.toEqual(c);
    // Still a valid 7-bag.
    expect([...a].sort()).toEqual([...PIECE_KINDS].sort());
  });

  it('uses the injected RNG for Fisher-Yates (rng() => 0 keeps the original order rotated through swaps)', () => {
    // With rng() always returning 0, Math.floor(0 * (i+1)) === 0 for
    // every iteration, so each step swaps position i with position 0.
    // For input ['I','O','T','S','Z','J','L'] this produces a
    // deterministic, well-defined permutation we can pin.
    const bag = createBag(() => 0);
    expect(bag).toEqual(['O', 'T', 'S', 'Z', 'J', 'L', 'I']);
  });
});

describe('drawFromBag', () => {
  it('pops the head and returns the remaining bag unchanged when bag had > 1 element', () => {
    const input: PieceKind[] = ['I', 'O', 'T', 'S'];
    const { piece, bag } = drawFromBag(input);
    expect(piece).toBe('I');
    expect(bag).toEqual(['O', 'T', 'S']);
  });

  it('returns a freshly refilled non-empty bag when the prior bag is emptied', () => {
    const input: PieceKind[] = ['Z'];
    const { piece, bag } = drawFromBag(input, mulberry32(7));
    expect(piece).toBe('Z');
    // Refill must be a full 7-bag.
    expect(bag).toHaveLength(7);
    expect([...bag].sort()).toEqual([...PIECE_KINDS].sort());
  });

  it('does not mutate the input bag', () => {
    const input: PieceKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    const snapshot = [...input];
    drawFromBag(input);
    expect(input).toEqual(snapshot);
  });

  it('accepts an injected RNG so refills are deterministic', () => {
    const a = drawFromBag(['I'], mulberry32(123));
    const b = drawFromBag(['I'], mulberry32(123));
    expect(a.piece).toBe('I');
    expect(b.piece).toBe('I');
    expect(a.bag).toEqual(b.bag);
  });

  it('drives a full bag → empty → refill cycle that yields all 7 kinds exactly once before refilling', () => {
    const rng = mulberry32(99);
    let bag = createBag(rng);
    const drawn: PieceKind[] = [];
    for (let i = 0; i < 7; i++) {
      const result = drawFromBag(bag, rng);
      drawn.push(result.piece);
      bag = result.bag;
    }
    expect([...drawn].sort()).toEqual([...PIECE_KINDS].sort());
    // After 7 draws the bag has been refilled, so it must still be
    // non-empty and a valid 7-bag.
    expect(bag).toHaveLength(7);
    expect([...bag].sort()).toEqual([...PIECE_KINDS].sort());
  });
});
