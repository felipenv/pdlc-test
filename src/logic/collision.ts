// Collision predicates and the lock-piece helper.
//
// These pure functions back movement, rotation, and lock-on-contact logic.
// They are deterministic and side-effect-free: no DOM access, no global
// state, no mutation of their input arguments. All checks are performed
// against the 10×22 playfield grid (which includes the 2 hidden buffer
// rows at the top) and the active piece's current rotation matrix from
// `TETROMINOES`.

import type { Grid, Piece, PieceKind } from '../types';
import { BOARD_HEIGHT_TOTAL, BOARD_WIDTH, TETROMINOES } from '../constants';

/**
 * Derive the absolute grid cells occupied by `piece` in its current
 * rotation state.
 *
 * Uses `TETROMINOES[piece.kind][piece.rotation]` (row-major, `1` = filled)
 * and offsets each filled cell by the piece's `(x, y)` bounding-box
 * top-left. The returned coordinates may include cells outside the
 * playfield (e.g. above row 0 when the piece is in the buffer); callers
 * are responsible for any further bounds interpretation.
 */
export function getPieceCells(piece: Piece): Array<{ x: number; y: number }> {
  const matrix = TETROMINOES[piece.kind][piece.rotation];
  const cells: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < matrix.length; row++) {
    const matrixRow = matrix[row];
    for (let col = 0; col < matrixRow.length; col++) {
      if (matrixRow[col] === 1) {
        cells.push({ x: piece.x + col, y: piece.y + row });
      }
    }
  }
  return cells;
}

/**
 * Return `true` when placing `piece` at its current position would be
 * invalid.
 *
 * A position is invalid if any occupied cell:
 *   - is outside the horizontal bounds (`x < 0` or `x >= BOARD_WIDTH`), or
 *   - is below the floor (`y >= BOARD_HEIGHT_TOTAL`), or
 *   - lies on a non-empty cell of `grid` (collision with a locked piece).
 *
 * Cells with `y < 0` (above the visible top of the grid, in the hidden
 * spawn region) are explicitly allowed — this enables pieces to spawn and
 * rotate partially above the visible playfield without being flagged as
 * collisions. `grid` is never mutated.
 */
export function collides(grid: Grid, piece: Piece): boolean {
  const cells = getPieceCells(piece);
  for (const { x, y } of cells) {
    if (x < 0 || x >= BOARD_WIDTH) {
      return true;
    }
    if (y >= BOARD_HEIGHT_TOTAL) {
      return true;
    }
    if (y < 0) {
      // Above row 0 — inside the hidden buffer; allowed.
      continue;
    }
    if (grid[y][x] !== null) {
      return true;
    }
  }
  return false;
}

/**
 * Return a new grid with `piece`'s cells written using its `PieceKind`
 * as the cell value.
 *
 * The input `grid` is not mutated: a shallow copy of the outer array
 * plus a `.slice()` copy of each row is taken before writing. Cells
 * outside the playfield bounds (including the buffer region with
 * `y < 0`) are silently skipped — callers should ensure the piece is
 * in a valid (non-colliding) position before locking.
 */
export function lockPiece(grid: Grid, piece: Piece): Grid {
  const newGrid: Grid = grid.map((row) => row.slice());
  const kind: PieceKind = piece.kind;
  for (const { x, y } of getPieceCells(piece)) {
    if (y < 0 || y >= BOARD_HEIGHT_TOTAL) continue;
    if (x < 0 || x >= BOARD_WIDTH) continue;
    newGrid[y][x] = kind;
  }
  return newGrid;
}
