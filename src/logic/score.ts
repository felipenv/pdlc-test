// Pure helpers for scoring, level progression, and gravity timing.
//
// These functions are referentially transparent: same inputs always
// produce the same outputs and they perform no I/O or mutation. They
// are intended to be composed by the game reducer and the tick loop.

import { GRAVITY_MS_BY_LEVEL, SCORING } from '../constants';

/**
 * Points awarded for clearing `linesCleared` rows at the given `level`.
 *
 * Uses the classic NES scoring table from `SCORING`:
 *   - 0 lines → 0
 *   - 1 line  → 100
 *   - 2 lines → 300
 *   - 3 lines → 500
 *   - 4 lines → 800 (a tetris)
 *
 * The level multiplier is `(level + 1)`, so a tetris at level 0 scores
 * 800 and the same tetris at level 1 scores 1600.
 *
 * Returns `0` when `linesCleared === 0` regardless of `level` — there is
 * no per-tick or soft-drop scoring handled here.
 */
export function scoreFor(linesCleared: number, level: number): number {
  if (linesCleared === 0) return 0;
  const base = SCORING[linesCleared] ?? 0;
  return base * (level + 1);
}

/**
 * Current level derived from total lines cleared.
 *
 * Levels advance every 10 cleared lines: 0..9 → 0, 10..19 → 1, 20..29 → 2,
 * and so on. Implementation is `Math.floor(totalLines / 10)`.
 */
export function levelFromLines(totalLines: number): number {
  return Math.floor(totalLines / 10);
}

/**
 * Gravity interval in milliseconds for the given `level`.
 *
 * Looks up `GRAVITY_MS_BY_LEVEL` and clamps the index to the last entry,
 * so any level at or beyond `GRAVITY_MS_BY_LEVEL.length - 1` returns the
 * minimum interval (50 ms in the current table). Level 0 returns
 * ~1000 ms.
 */
export function gravityIntervalMs(level: number): number {
  const index = Math.min(level, GRAVITY_MS_BY_LEVEL.length - 1);
  return GRAVITY_MS_BY_LEVEL[index]!;
}
