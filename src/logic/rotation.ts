// Pure SRS rotation with basic wall kicks.
//
// `rotateActiveCW` / `rotateActiveCCW` attempt to rotate the active piece
// clockwise / counter-clockwise. For each direction they iterate the SRS
// kick-table entry for the appropriate `from -> to` transition (selecting
// the I-piece table or the JLSTZ table from `piece.kind`) and return the
// rotated piece at the first non-colliding offset. When no offset clears,
// the original piece is returned unchanged. The O piece is returned as-is
// because all four of its rotation states are identical.
//
// These functions are referentially transparent: they read `grid` and
// `piece` but never mutate either argument, perform no I/O, and touch no
// DOM.

import { SRS_KICK_TABLE } from '../constants';
import type { Grid, Piece } from '../types';
import { collides } from './collision';

/** Valid SRS rotation indices. */
type Rotation = 0 | 1 | 2 | 3;

/**
 * Try to rotate `piece` from its current rotation to `toRotation`, applying
 * SRS wall-kick offsets in order. Returns the rotated piece at the first
 * offset that does not collide with `grid`, or the original `piece` if no
 * offset clears (or the piece is O, which never visibly rotates).
 *
 * Per the kick-table comment in `src/constants.ts`, offsets use the SRS
 * convention with positive y = upward. `Grid` uses y growing downward, so
 * the y component of each offset is negated when constructing the candidate.
 */
function tryRotate(grid: Grid, piece: Piece, toRotation: Rotation): Piece {
  // O has identical matrices for all four rotation states — nothing to do.
  if (piece.kind === 'O') {
    return piece;
  }

  const transition = `${piece.rotation}->${toRotation}` as
    | '0->1'
    | '1->0'
    | '1->2'
    | '2->1'
    | '2->3'
    | '3->2'
    | '3->0'
    | '0->3';

  const table = piece.kind === 'I' ? SRS_KICK_TABLE.I : SRS_KICK_TABLE.JLSTZ;
  const offsets = table[transition];

  for (const [dx, dy] of offsets) {
    const candidate: Piece = {
      ...piece,
      rotation: toRotation,
      x: piece.x + dx,
      // Negate dy: kick tables are SRS-up-positive, Grid is down-positive.
      y: piece.y - dy,
    };
    if (!collides(grid, candidate)) {
      return candidate;
    }
  }

  return piece;
}

/**
 * Attempt to rotate the active piece clockwise.
 *
 * Iterates the SRS kick-table entry for the current
 * `rotation -> (rotation + 1) mod 4` transition (I-piece or JLSTZ table
 * selected from `piece.kind`) and returns the rotated piece at the first
 * non-colliding offset. Returns the original `piece` when every offset
 * collides, or unchanged when `piece.kind === 'O'`.
 */
export function rotateActiveCW(grid: Grid, piece: Piece): Piece {
  const next = ((piece.rotation + 1) & 3) as Rotation;
  return tryRotate(grid, piece, next);
}

/**
 * Attempt to rotate the active piece counter-clockwise.
 *
 * Symmetric to `rotateActiveCW`: iterates the SRS kick-table entry for the
 * current `rotation -> (rotation + 3) mod 4` transition and returns the
 * rotated piece at the first non-colliding offset, or the original piece
 * when every offset collides. Returns the piece unchanged when
 * `piece.kind === 'O'`.
 */
export function rotateActiveCCW(grid: Grid, piece: Piece): Piece {
  const next = ((piece.rotation + 3) & 3) as Rotation;
  return tryRotate(grid, piece, next);
}
