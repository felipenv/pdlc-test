// Tunable constants and lookup tables for the Tetris game.
//
// All values in this module are compile-time constants. There are no
// top-level side effects — only `export const` declarations — so importing
// this module is free of cost beyond the constant tables themselves.

import type { PieceKind } from './types';

// ---------------------------------------------------------------------------
// Piece set
// ---------------------------------------------------------------------------

/**
 * Canonical list of all seven tetromino kinds.
 *
 * Used as the source of truth for the 7-bag piece generator
 * (`src/logic/bag.ts`) and anywhere else that needs to enumerate the
 * full set of `PieceKind` values at runtime.
 */
export const PIECE_KINDS: readonly PieceKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;

// ---------------------------------------------------------------------------
// Board dimensions
// ---------------------------------------------------------------------------

/** Number of columns on the playfield. */
export const BOARD_WIDTH = 10;

/** Total number of rows on the playfield, including hidden buffer rows. */
export const BOARD_HEIGHT_TOTAL = 22;

/** Number of visible rows on the playfield. */
export const BOARD_HEIGHT_VISIBLE = 20;

/** Number of hidden buffer rows at the top of the playfield. */
export const HIDDEN_ROWS = 2;

// ---------------------------------------------------------------------------
// Tetromino rotation matrices (canonical SRS shapes)
// ---------------------------------------------------------------------------
//
// Each piece is indexed by `PieceKind` and exposes four rotation states
// (0, 1, 2, 3) following the Super Rotation System (SRS):
//
//   - I uses a 4×4 bounding box.
//   - O uses a 2×2 bounding box (all four rotations are identical).
//   - T, S, Z, J, L use 3×3 bounding boxes.
//
// Cells are `1` for a filled square, `0` for empty. Matrices are stored
// row-major: `matrix[row][col]`.

/** Lookup of canonical SRS rotation matrices for each tetromino. */
export const TETROMINOES: Record<PieceKind, number[][][]> = {
  I: [
    // R0
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    // R1
    [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
    ],
    // R2
    [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
    ],
    // R3
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
    ],
  ],
  O: [
    // O does not rotate; all four states are the same 2×2 block.
    [
      [1, 1],
      [1, 1],
    ],
    [
      [1, 1],
      [1, 1],
    ],
    [
      [1, 1],
      [1, 1],
    ],
    [
      [1, 1],
      [1, 1],
    ],
  ],
  T: [
    // R0
    [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    // R1
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 1, 0],
    ],
    // R2
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
    // R3
    [
      [0, 1, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
  ],
  S: [
    // R0
    [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    // R1
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
    ],
    // R2
    [
      [0, 0, 0],
      [0, 1, 1],
      [1, 1, 0],
    ],
    // R3
    [
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
  ],
  Z: [
    // R0
    [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    // R1
    [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    // R2
    [
      [0, 0, 0],
      [1, 1, 0],
      [0, 1, 1],
    ],
    // R3
    [
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  ],
  J: [
    // R0
    [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    // R1
    [
      [0, 1, 1],
      [0, 1, 0],
      [0, 1, 0],
    ],
    // R2
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 0, 1],
    ],
    // R3
    [
      [0, 1, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
  ],
  L: [
    // R0
    [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    // R1
    [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 1],
    ],
    // R2
    [
      [0, 0, 0],
      [1, 1, 1],
      [1, 0, 0],
    ],
    // R3
    [
      [1, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
    ],
  ],
};

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

/** Canonical color for each tetromino (cyan/yellow/purple/green/red/blue/orange). */
export const COLORS: Record<PieceKind, string> = {
  I: '#00ffff',
  O: '#ffff00',
  T: '#a020f0',
  S: '#00ff00',
  Z: '#ff0000',
  J: '#0000ff',
  L: '#ffa500',
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Points awarded for clearing N lines simultaneously.
 *
 * Index by the number of lines cleared: 0, 1 (single), 2 (double),
 * 3 (triple), 4 (tetris). Level multiplier (if any) is applied by the
 * scoring reducer, not stored here.
 */
export const SCORING: readonly number[] = [0, 100, 300, 500, 800];

// ---------------------------------------------------------------------------
// Gravity curve
// ---------------------------------------------------------------------------

/**
 * Milliseconds per gravity step at each level.
 *
 * Approximates the classic NES / Tetris Worlds curve, decaying from
 * ~1000 ms at level 0 down to a 50 ms floor by level 10. Levels beyond
 * the last entry should be clamped by the caller, e.g.
 * `GRAVITY_MS_BY_LEVEL[Math.min(level, GRAVITY_MS_BY_LEVEL.length - 1)]`.
 *
 * Indices 10..15 are clamped to 50 ms so the floor is reached early and
 * sustained — matching the "values beyond level 15 clamp to 50 ms" rule.
 */
export const GRAVITY_MS_BY_LEVEL: readonly number[] = [
  1000, // level 0
  793, //  level 1
  618, //  level 2
  473, //  level 3
  355, //  level 4
  262, //  level 5
  190, //  level 6
  135, //  level 7
  94, //   level 8
  64, //   level 9
  50, //   level 10
  50, //   level 11
  50, //   level 12
  50, //   level 13
  50, //   level 14
  50, //   level 15
];

// ---------------------------------------------------------------------------
// SRS wall-kick tables
// ---------------------------------------------------------------------------
//
// Wall-kick offsets are applied in order; the first offset that yields a
// valid (non-colliding, in-bounds) position is used. Offsets are stored as
// `[dx, dy]` tuples using the canonical SRS sign convention (positive y =
// upward). Consumers that use a downward-positive grid must negate the y
// component when applying.
//
// Keys are rotation transitions in the form `"from->to"`, where the states
// are 0 (spawn), 1 (right / R), 2 (180), 3 (left / L).

/** SRS rotation transition key. */
type SrsTransition =
  | '0->1'
  | '1->0'
  | '1->2'
  | '2->1'
  | '2->3'
  | '3->2'
  | '3->0'
  | '0->3';

/** Wall-kick offsets for J, L, S, T, Z pieces. */
export const SRS_KICK_TABLE_JLSTZ: Record<SrsTransition, readonly (readonly [number, number])[]> = {
  '0->1': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '1->0': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '1->2': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '2->1': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '2->3': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '3->2': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '3->0': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '0->3': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
};

/** Wall-kick offsets for the I piece (distinct from JLSTZ). */
export const SRS_KICK_TABLE_I: Record<SrsTransition, readonly (readonly [number, number])[]> = {
  '0->1': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  '1->0': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  '1->2': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  '2->1': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '2->3': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  '3->2': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  '3->0': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '0->3': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
};

/**
 * Composite SRS kick table. Use `SRS_KICK_TABLE.I` for the I piece and
 * `SRS_KICK_TABLE.JLSTZ` for all other rotatable pieces. (The O piece
 * never needs to kick because all four of its rotation states are
 * identical.)
 */
export const SRS_KICK_TABLE = {
  JLSTZ: SRS_KICK_TABLE_JLSTZ,
  I: SRS_KICK_TABLE_I,
} as const;
