// Unit tests for src/logic/rotation.ts.
//
// Verifies SRS rotation with basic wall kicks: O-piece is identity,
// free-space CW/CCW advances rotation by ±1 mod 4 with the [0,0] kick,
// wall-pressed pieces succeed via non-zero offsets, the I-piece uses its
// dedicated kick table (distinct from JLSTZ), and rotation is rejected
// (original piece returned) when every kick offset still collides.

import { describe, expect, it } from 'vitest';

import { BOARD_HEIGHT_TOTAL, BOARD_WIDTH } from '../constants';
import type { Grid, Piece, PieceKind } from '../types';

import { getPieceCells } from './collision';
import { rotateActiveCCW, rotateActiveCW } from './rotation';

function emptyGrid(): Grid {
  return Array.from({ length: BOARD_HEIGHT_TOTAL }, () =>
    Array.from({ length: BOARD_WIDTH }, () => null),
  );
}

/**
 * Build a grid completely filled with locked cells *except* the cells
 * occupied by `piece`. Used to construct scenarios where every wall-kick
 * offset for a rotation lands on at least one filled cell, forcing
 * rejection.
 */
function fullGridExcept(piece: Piece): Grid {
  // Use a `PieceKind | null` typed value so each row widens to
  // `(PieceKind | null)[]` instead of the literal `'I'[]`.
  const filled: PieceKind | null = 'I';
  const grid: Grid = Array.from({ length: BOARD_HEIGHT_TOTAL }, () =>
    Array.from({ length: BOARD_WIDTH }, () => filled),
  );
  for (const { x, y } of getPieceCells(piece)) {
    if (y >= 0 && y < BOARD_HEIGHT_TOTAL && x >= 0 && x < BOARD_WIDTH) {
      grid[y][x] = null;
    }
  }
  return grid;
}

describe('rotateActiveCW / rotateActiveCCW: O piece', () => {
  it('returns the O piece unchanged when rotating clockwise', () => {
    const piece: Piece = { kind: 'O', rotation: 0, x: 4, y: 0 };
    const result = rotateActiveCW(emptyGrid(), piece);
    expect(result).toBe(piece);
  });

  it('returns the O piece unchanged when rotating counter-clockwise', () => {
    const piece: Piece = { kind: 'O', rotation: 2, x: 4, y: 0 };
    const result = rotateActiveCCW(emptyGrid(), piece);
    expect(result).toBe(piece);
  });
});

describe('rotateActiveCW: free-space rotation', () => {
  it('rotates a T piece clockwise using the [0,0] kick in open space', () => {
    const piece: Piece = { kind: 'T', rotation: 0, x: 4, y: 5 };
    const result = rotateActiveCW(emptyGrid(), piece);

    expect(result.rotation).toBe(1);
    expect(result.x).toBe(4);
    expect(result.y).toBe(5);
    expect(result.kind).toBe('T');
  });

  it('advances rotation by +1 mod 4 (3 -> 0)', () => {
    const piece: Piece = { kind: 'T', rotation: 3, x: 4, y: 5 };
    const result = rotateActiveCW(emptyGrid(), piece);
    expect(result.rotation).toBe(0);
  });
});

describe('rotateActiveCCW: free-space rotation', () => {
  it('rotates a T piece counter-clockwise using the [0,0] kick in open space', () => {
    const piece: Piece = { kind: 'T', rotation: 1, x: 4, y: 5 };
    const result = rotateActiveCCW(emptyGrid(), piece);

    expect(result.rotation).toBe(0);
    expect(result.x).toBe(4);
    expect(result.y).toBe(5);
  });

  it('advances rotation by -1 mod 4 (0 -> 3)', () => {
    const piece: Piece = { kind: 'T', rotation: 0, x: 4, y: 5 };
    const result = rotateActiveCCW(emptyGrid(), piece);
    expect(result.rotation).toBe(3);
  });
});

describe('rotateActiveCW: JLSTZ wall kicks', () => {
  it('applies a non-zero kick offset when [0,0] collides (T 0->1)', () => {
    // T R0 at (4, 10) occupies: (5,10), (4,11), (5,11), (6,11).
    // Rotating CW to R1 at the [0,0] kick produces cells:
    //   (5,10), (5,11), (6,11), (5,12).
    // Blocking grid[12][5] forces the [0,0] candidate to collide.
    // The next JLSTZ 0->1 kick is [-1, 0], which moves the candidate to
    // (3, 10) with cells (4,10), (4,11), (5,11), (4,12) — all empty.
    const piece: Piece = { kind: 'T', rotation: 0, x: 4, y: 10 };
    const grid = emptyGrid();
    grid[12][5] = 'Z';

    const result = rotateActiveCW(grid, piece);
    expect(result.rotation).toBe(1);
    expect(result.x).toBe(3);
    expect(result.y).toBe(10);
  });
});

describe('rotateActiveCW: I piece uses the I kick table', () => {
  it('selects the I kick table (not JLSTZ) for the I piece (1->2)', () => {
    // I R1 (vertical) at (0, 5) occupies (2,5), (2,6), (2,7), (2,8).
    // Rotating CW to R2 (horizontal). The [0,0] candidate has cells
    // (0,7), (1,7), (2,7), (3,7); blocking grid[7][0] forces it to
    // collide.
    //
    // I 1->2 kicks: [0,0], [-1, 0], [2, 0], [-1, 2], [2, -1].
    //   [-1, 0] candidate at x = -1 is out of bounds → still collides.
    //   [ 2, 0] candidate at x =  2: cells (2,7), (3,7), (4,7), (5,7)
    //   are all empty → succeeds.
    //
    // If JLSTZ 1->2 were (incorrectly) used, its second offset is
    //   [1, 0] → candidate at x = 1: cells (1,7), (2,7), (3,7), (4,7)
    //   all empty → would succeed with x = 1, NOT x = 2.
    //
    // Expecting x = 2 confirms the I kick table was selected.
    const piece: Piece = { kind: 'I', rotation: 1, x: 0, y: 5 };
    const grid = emptyGrid();
    grid[7][0] = 'L';

    const result = rotateActiveCW(grid, piece);
    expect(result.rotation).toBe(2);
    expect(result.x).toBe(2);
    expect(result.y).toBe(5);
  });
});

describe('rotateActiveCW / rotateActiveCCW: rejection', () => {
  it('returns the original piece when every kick offset still collides (CW)', () => {
    // Fill every cell except the original T piece's footprint. Any rotated
    // candidate must occupy at least one filled cell on some kick offset,
    // so every offset collides and the original piece is returned.
    const piece: Piece = { kind: 'T', rotation: 0, x: 4, y: 10 };
    const grid = fullGridExcept(piece);

    const result = rotateActiveCW(grid, piece);
    expect(result).toBe(piece);
  });

  it('returns the original piece when every kick offset still collides (CCW)', () => {
    const piece: Piece = { kind: 'T', rotation: 0, x: 4, y: 10 };
    const grid = fullGridExcept(piece);

    const result = rotateActiveCCW(grid, piece);
    expect(result).toBe(piece);
  });
});
