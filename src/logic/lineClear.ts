// Pure line-clear helper for the Tetris playfield.
//
// `clearLines` scans the 10×22 internal grid for fully occupied rows,
// removes them, and prepends empty rows on top to preserve the original
// dimensions. It also reports how many rows were cleared so callers can
// feed that into the scoring helper (`scoreFor` in `./score.ts`) and the
// level progression (`levelFromLines`).
//
// The function is referentially transparent: same input always produces
// the same output, and it does not mutate the input grid (neither the
// outer array nor any inner row).

import type { Grid } from '../types';
import { BOARD_HEIGHT_TOTAL, BOARD_WIDTH } from '../constants';

/**
 * Remove fully occupied rows from `grid` and shift the remaining rows
 * downward by prepending empty rows on top.
 *
 * A row is considered "full" when every cell is non-null (i.e. occupied
 * by a locked piece). Full rows are filtered out, the surviving rows
 * (shallow-copied so the result shares no row references with the input)
 * are kept in their original order, and the result is padded at the top
 * with fresh empty rows until it again has `BOARD_HEIGHT_TOTAL` rows.
 *
 * The input `grid` is never mutated. Returns `{ grid, cleared }` where
 * `cleared` is the number of rows removed.
 */
export function clearLines(grid: Grid): { grid: Grid; cleared: number } {
  const survivors: Grid = [];
  let cleared = 0;
  for (const row of grid) {
    if (row.every((cell) => cell !== null)) {
      cleared += 1;
    } else {
      // Shallow-copy each surviving row so the returned grid shares no
      // row references with the input.
      survivors.push(row.slice());
    }
  }

  // Prepend `cleared` fresh empty rows to restore the 10×22 shape.
  // Each new row is its own array so no references are shared.
  const prepend: Grid = Array.from({ length: cleared }, () =>
    Array.from({ length: BOARD_WIDTH }, () => null),
  );
  const newGrid: Grid = prepend.concat(survivors);

  // Sanity guard against pathological inputs: the result must always be
  // BOARD_HEIGHT_TOTAL rows tall. For a well-formed 22-row input this is
  // already satisfied because `survivors.length + cleared === grid.length`.
  // The branch is kept defensive but is a no-op in normal use.
  while (newGrid.length < BOARD_HEIGHT_TOTAL) {
    newGrid.unshift(Array.from({ length: BOARD_WIDTH }, () => null));
  }

  return { grid: newGrid, cleared };
}
