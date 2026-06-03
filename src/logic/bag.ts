// 7-bag tetromino piece generator.
//
// Modern Tetris randomization: the seven `PieceKind` values are placed
// into a "bag" and dealt one at a time; once the bag is empty it is
// refilled with all seven kinds in a fresh random order. This guarantees
// a piece appears at most once every 14 draws (7 from the previous bag
// plus 7 from the next) and never more than 12 draws between repeats.
//
// All exports are **pure functions**: no DOM access, no module-level
// mutable state, and the RNG can be injected for deterministic tests.

import type { PieceKind } from '../types';
import { PIECE_KINDS } from '../constants';

/**
 * Fisher-Yates (Knuth) shuffle.
 *
 * Returns a NEW array — the input is not mutated. The injected `rng`
 * must return a number in `[0, 1)` (same contract as `Math.random`).
 */
function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Build a freshly shuffled bag containing exactly one of each
 * `PieceKind` (length 7).
 *
 * @param rng - Optional random source returning values in `[0, 1)`.
 *              Defaults to `Math.random`. Inject a deterministic RNG in
 *              tests for reproducible permutations.
 */
export function createBag(rng: () => number = Math.random): PieceKind[] {
  return shuffle(PIECE_KINDS, rng);
}

/**
 * Draw the next piece from a 7-bag.
 *
 * Removes the first element of `bag` and returns it as `piece`. The
 * returned `bag` is the remainder; if removing the head emptied the
 * bag, the returned `bag` is a freshly shuffled new bag so callers
 * always receive a non-empty bag for the next draw.
 *
 * The input `bag` array is NOT mutated.
 *
 * @param bag - The current bag. Must contain at least one piece.
 * @param rng - Optional RNG for the refill shuffle (defaults to
 *              `Math.random`).
 */
export function drawFromBag(
  bag: PieceKind[],
  rng: () => number = Math.random,
): { piece: PieceKind; bag: PieceKind[] } {
  const piece = bag[0];
  const remaining = bag.slice(1);
  const nextBag = remaining.length === 0 ? createBag(rng) : remaining;
  return { piece, bag: nextBag };
}
