// Unit tests for src/logic/collision.ts.
//
// Verifies the three exported helpers: `getPieceCells` (matrix → absolute
// cells), `collides` (wall / floor / overlap / buffer-row rules), and
// `lockPiece` (non-mutating grid update).

import { describe, expect, it } from 'vitest';

import { BOARD_HEIGHT_TOTAL, BOARD_WIDTH } from '../constants';
import type { Grid, Piece } from '../types';

import { collides, getPieceCells, lockPiece } from './collision';

function emptyGrid(): Grid {
  return Array.from({ length: BOARD_HEIGHT_TOTAL }, () =>
    Array.from({ length: BOARD_WIDTH }, () => null),
  );
}

function tPiece(x: number, y: number, rotation: Piece['rotation'] = 0): Piece {
  return { kind: 'T', rotation, x, y };
}

describe('getPieceCells', () => {
  it('returns the 4 absolute cells of a T-piece at the origin (R0)', () => {
    // T R0:
    //   . # .
    //   # # #
    //   . . .
    const cells = getPieceCells(tPiece(0, 0));
    expect(cells).toEqual([
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
  });

  it('offsets cells by the piece position', () => {
    const cells = getPieceCells(tPiece(3, 5));
    expect(cells).toEqual([
      { x: 4, y: 5 },
      { x: 3, y: 6 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
    ]);
  });

  it('returns 4 cells for an O-piece (all rotations identical)', () => {
    const o: Piece = { kind: 'O', rotation: 0, x: 4, y: 0 };
    const cells = getPieceCells(o);
    expect(cells).toEqual([
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ]);
  });
});

describe('collides', () => {
  it('returns false for a clear in-bounds position', () => {
    expect(collides(emptyGrid(), tPiece(3, 5))).toBe(false);
  });

  it('returns true when the piece crosses the left wall', () => {
    // T R0 has a filled cell at col 0 of row 1, so at x = -1 it's outside.
    expect(collides(emptyGrid(), tPiece(-1, 5))).toBe(true);
  });

  it('returns true when the piece crosses the right wall', () => {
    // Bounding box is 3 wide, so x = BOARD_WIDTH - 2 places the right
    // column of the matrix at x = BOARD_WIDTH (out of bounds).
    expect(collides(emptyGrid(), tPiece(BOARD_WIDTH - 2, 5))).toBe(true);
  });

  it('returns true when the piece extends below the floor', () => {
    // The bottom-filled row of T R0 is matrix row 1, so placing y at
    // BOARD_HEIGHT_TOTAL - 1 puts that row at BOARD_HEIGHT_TOTAL (floor).
    expect(collides(emptyGrid(), tPiece(3, BOARD_HEIGHT_TOTAL - 1))).toBe(true);
  });

  it('returns true when a piece cell overlaps a non-empty grid cell', () => {
    const grid = emptyGrid();
    // T R0 at (3, 5) occupies (4,5), (3,6), (4,6), (5,6).
    grid[6][4] = 'Z';
    expect(collides(grid, tPiece(3, 5))).toBe(true);
  });

  it('returns false when part of the piece sits in the buffer (y < 0)', () => {
    // T at y = -1: matrix row 0 → absolute y = -1 (buffer, allowed);
    // matrix row 1 → absolute y = 0 (visible, must be empty).
    expect(collides(emptyGrid(), tPiece(3, -1))).toBe(false);
  });
});

describe('lockPiece', () => {
  it('writes the piece kind into the expected cells', () => {
    const grid = emptyGrid();
    const piece = tPiece(3, 5);
    const next = lockPiece(grid, piece);

    expect(next[5][4]).toBe('T');
    expect(next[6][3]).toBe('T');
    expect(next[6][4]).toBe('T');
    expect(next[6][5]).toBe('T');
  });

  it('does not mutate the input grid', () => {
    const grid = emptyGrid();
    // Snapshot the original grid by deep clone for later comparison.
    const snapshot = grid.map((row) => row.slice());

    const next = lockPiece(grid, tPiece(3, 5));

    expect(grid).toEqual(snapshot);
    expect(next).not.toBe(grid);
    // Row references should not be shared with the input either.
    expect(next[5]).not.toBe(grid[5]);
    expect(next[6]).not.toBe(grid[6]);
  });

  it('preserves existing locked cells outside the piece footprint', () => {
    const grid = emptyGrid();
    grid[0][0] = 'I';
    grid[21][9] = 'L';

    const next = lockPiece(grid, tPiece(3, 5));

    expect(next[0][0]).toBe('I');
    expect(next[21][9]).toBe('L');
  });
});
