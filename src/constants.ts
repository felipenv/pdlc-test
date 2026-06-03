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
// Colors — monochrome LCD palette
// ---------------------------------------------------------------------------
//
// The renderer draws every locked cell and the active piece in a single
// near-black `ink` and every empty cell as a dim `ghost` outline on the
// LCD-style `screen` background, evoking a classic handheld Tetris look.
// All literals live here so `src/render.ts` (and any future module) can
// import them by name — no magic colors should be duplicated downstream.

/**
 * Canonical monochrome LCD palette.
 *
 * - `ink`         — near-black hex used for both locked cells and the
 *                   active piece (the "on" brick glyph).
 * - `ghost`       — faint dim color used for the "off" brick outline
 *                   drawn on every empty cell.
 * - `screen`      — greenish-grey LCD background fill for both the
 *                   playfield canvas and the next-piece preview canvas.
 * - `overlayTint` — darkened LCD-green semi-transparent fill painted
 *                   over the playfield for the PAUSED / GAME OVER
 *                   overlays.
 */
export const LCD_PALETTE = {
  ink: '#1a1a1a',
  ghost: 'rgba(26, 26, 26, 0.18)',
  screen: '#9ca989',
  overlayTint: 'rgba(40, 56, 40, 0.55)',
} as const;

// ---------------------------------------------------------------------------
// Brick-glyph geometry
// ---------------------------------------------------------------------------
//
// Each cell is rendered as two concentric shapes — an outer rounded
// rectangle that traces the brick's silhouette and an inner filled
// rectangle that gives it the chunky LCD pixel look. Both "on" and "off"
// cells use the same geometry so the only difference between a locked /
// active brick and an empty slot is the fill / stroke colour pulled from
// {@link LCD_PALETTE}.

/**
 * Padding (in pixels) between the cell edge and the outer rounded
 * rectangle. Controls how much of the cell is whitespace around the
 * brick silhouette.
 */
export const BRICK_OUTER_PADDING = 2;

/**
 * Padding (in pixels) between the outer rounded rectangle and the inner
 * filled rectangle. Controls the thickness of the visible brick "ring".
 */
export const BRICK_INNER_PADDING = 4;

/**
 * Corner radius (in pixels) for the outer rounded rectangle. Gives the
 * brick its softened LCD-pixel silhouette.
 */
export const BRICK_CORNER_RADIUS = 3;

/**
 * Canonical color for each tetromino (cyan/yellow/purple/green/red/blue/orange).
 *
 * @deprecated The monochrome LCD redesign no longer uses per-kind cell
 * colors — locked cells and the active piece are both rendered in
 * {@link LCD_PALETTE.ink}, and empty cells use {@link LCD_PALETTE.ghost}.
 * This export is retained temporarily so existing consumers in
 * `src/render.ts` continue to compile until they are rewired to the
 * new palette in a follow-up story; do not introduce new references.
 */
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
