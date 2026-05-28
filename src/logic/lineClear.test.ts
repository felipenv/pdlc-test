// Unit tests for src/logic/lineClear.ts.
//
// Verifies the `clearLines` contract: identifies full rows, prepends empty
// rows on top to preserve the 10×22 dimensions, reports the cleared count,
// and never mutates the input grid.

import { describe, expect, it } from 'vitest';

import { BOARD_HEIGHT_TOTAL, BOARD_WIDTH } from '../constants';
import type { Grid } from '../types';

import { clearLines } from './lineClear';

function emptyGrid(): Grid {
  return Array.from({ length: BOARD_HEIGHT_TOTAL }, () =>
    Array.from({ length: BOARD_WIDTH }, () => null),
  );
}

function fullRow(): Grid[number] {
  return Array.from({ length: BOARD_WIDTH }, () => 'I' as const);
}

function deepClone(grid: Grid): Grid {
  return grid.map((row) => row.slice());
}

describe('clearLines', () => {
  it('returns cleared = 0 and an equivalent grid when no rows are full', () => {
    const grid = emptyGrid();
    // Scatter a few locked cells so the grid is non-empty but no row is full.
    grid[5][3] = 'T';
    grid[20][0] = 'L';
    grid[21][9] = 'Z';

    const { grid: next, cleared } = clearLines(grid);

    expect(cleared).toBe(0);
    expect(next).toEqual(grid);
    expect(next.length).toBe(BOARD_HEIGHT_TOTAL);
    next.forEach((row) => expect(row.length).toBe(BOARD_WIDTH));
  });

  it('does not mutate the input grid and returns a fresh outer array', () => {
    const grid = emptyGrid();
    grid[10] = fullRow();
    grid[21] = fullRow();
    const snapshot = deepClone(grid);

    const { grid: next } = clearLines(grid);

    expect(grid).toEqual(snapshot);
    expect(next).not.toBe(grid);
    // No row references should be shared with the input.
    for (const row of next) {
      for (const original of grid) {
        expect(row).not.toBe(original);
      }
    }
  });

  it('clears a single full row in the middle and shifts rows above down by one', () => {
    const grid = emptyGrid();
    // Add a marker above and below the full row so we can verify the shift.
    grid[8][2] = 'S';
    grid[10] = fullRow();
    grid[15][7] = 'J';

    const { grid: next, cleared } = clearLines(grid);

    expect(cleared).toBe(1);
    expect(next.length).toBe(BOARD_HEIGHT_TOTAL);
    next.forEach((row) => expect(row.length).toBe(BOARD_WIDTH));

    // The row that was at index 8 now sits at index 9 (shifted down by 1).
    expect(next[9][2]).toBe('S');
    // The row that was at index 15 stays at index 15 (below the cleared row).
    expect(next[15][7]).toBe('J');
    // A brand-new empty row was prepended at index 0.
    expect(next[0]).toEqual(Array.from({ length: BOARD_WIDTH }, () => null));
  });

  it('clears multiple non-adjacent full rows and preserves surviving order', () => {
    const grid = emptyGrid();
    // Markers to track positions before/after the clear.
    grid[5][0] = 'T';
    grid[10] = fullRow();
    grid[15][9] = 'L';
    grid[21] = fullRow();

    const { grid: next, cleared } = clearLines(grid);

    expect(cleared).toBe(2);
    expect(next.length).toBe(BOARD_HEIGHT_TOTAL);

    // First two rows should be the freshly prepended empty rows.
    expect(next[0]).toEqual(Array.from({ length: BOARD_WIDTH }, () => null));
    expect(next[1]).toEqual(Array.from({ length: BOARD_WIDTH }, () => null));

    // The marker originally at row 5 shifts down by 2 → row 7.
    expect(next[7][0]).toBe('T');
    // The marker originally at row 15 shifts down by 1 (one cleared row above
    // it: row 10; the row 21 clear is below it) → row 16.
    expect(next[16][9]).toBe('L');
  });

  it('clears a tetris (4 stacked full rows at the bottom)', () => {
    const grid = emptyGrid();
    grid[5][4] = 'O'; // marker above the tetris
    grid[18] = fullRow();
    grid[19] = fullRow();
    grid[20] = fullRow();
    grid[21] = fullRow();

    const { grid: next, cleared } = clearLines(grid);

    expect(cleared).toBe(4);
    expect(next.length).toBe(BOARD_HEIGHT_TOTAL);

    // Top 4 rows are freshly empty.
    for (let y = 0; y < 4; y += 1) {
      expect(next[y]).toEqual(Array.from({ length: BOARD_WIDTH }, () => null));
    }
    // The marker originally at row 5 shifts down by 4 → row 9.
    expect(next[9][4]).toBe('O');
    // The bottom rows are now empty (the tetris cleared the entire stack).
    for (let y = 18; y < BOARD_HEIGHT_TOTAL; y += 1) {
      expect(next[y]).toEqual(Array.from({ length: BOARD_WIDTH }, () => null));
    }
  });

  it('returns an empty grid (all empty rows) when every row is full', () => {
    const grid: Grid = Array.from({ length: BOARD_HEIGHT_TOTAL }, () => fullRow());

    const { grid: next, cleared } = clearLines(grid);

    expect(cleared).toBe(BOARD_HEIGHT_TOTAL);
    expect(next.length).toBe(BOARD_HEIGHT_TOTAL);
    next.forEach((row) =>
      expect(row).toEqual(Array.from({ length: BOARD_WIDTH }, () => null)),
    );
  });
});
