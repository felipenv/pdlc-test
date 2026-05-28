// Pure reducer-style updates for the Tetris `GameState`.
//
// These functions are the single source of truth for advancing the game
// state in response to player actions (movement, rotation, soft/hard
// drop, pause/resume, restart) and the gravity tick from the game loop.
//
// Contracts shared by every exported function:
//   - **Pure**: no DOM access, no module-level mutable state, and no
//     mutation of the input `state`, its `grid`, its `bag`, or its
//     `active` piece. A new `GameState` value is always returned.
//   - **Composable**: the heavy lifting lives in the helper modules
//     (`bag`, `collision`, `rotation`, `lineClear`, `score`); this file
//     just orchestrates them.
//   - **Deterministic when seeded**: any function that draws from the
//     7-bag accepts an optional `rng` parameter so tests can pin the
//     piece sequence.

import { BOARD_HEIGHT_TOTAL, BOARD_WIDTH } from '../constants';
import type { GameState, Grid, Piece, PieceKind } from '../types';

import { createBag, drawFromBag } from './bag';
import { collides, lockPiece } from './collision';
import { clearLines } from './lineClear';
import { rotateActiveCCW, rotateActiveCW } from './rotation';
import { gravityIntervalMs, levelFromLines, scoreFor } from './score';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build a fresh 22×10 grid filled with `null`. */
function emptyGrid(): Grid {
  return Array.from({ length: BOARD_HEIGHT_TOTAL }, () =>
    Array.from({ length: BOARD_WIDTH }, () => null),
  );
}

/**
 * Initial x for a fresh spawn. With a 10-wide board the canonical
 * placements are:
 *   - **O** (2-wide bbox) → x = 4 → cols 4..5
 *   - **I** (4-wide bbox) → x = 3 → cols 3..6 (filled row of the matrix
 *     covers cols 0..3 of the bbox, i.e. cols 3..6 absolute)
 *   - **T/S/Z/J/L** (3-wide bbox) → x = 3 → cols 3..5
 */
function spawnX(kind: PieceKind): number {
  return kind === 'O' ? 4 : 3;
}

/** Build a freshly-spawned piece at the top of the hidden buffer. */
function spawnPiece(kind: PieceKind): Piece {
  return { kind, rotation: 0, x: spawnX(kind), y: 0 };
}

/**
 * Common tail for "lock current piece, clear lines, score, spawn next":
 * shared by `hardDrop` and the gravity branch of `tick`.
 *
 * `lockedGrid` must already be the grid AFTER `lockPiece(state.grid,
 * activeAtRest)` — this helper does not lock; it just composes the
 * clear/score/draw/spawn steps and detects game-over.
 */
function lockAndSpawn(
  state: GameState,
  lockedGrid: Grid,
  rng: () => number,
): GameState {
  const { grid: clearedGrid, cleared } = clearLines(lockedGrid);
  const gained = scoreFor(cleared, state.level);
  const newLines = state.lines + cleared;
  const newLevel = levelFromLines(newLines);
  const newScore = state.score + gained;

  // Draw the kind for the *new* next piece; the active piece becomes
  // whatever was previously queued in `state.next`.
  const { piece: drawnNext, bag: bagAfterDraw } = drawFromBag(state.bag, rng);
  const spawned = spawnPiece(state.next);

  if (collides(clearedGrid, spawned)) {
    return {
      grid: clearedGrid,
      active: null,
      next: drawnNext,
      bag: bagAfterDraw,
      score: newScore,
      lines: newLines,
      level: newLevel,
      status: 'gameover',
      gravityAccumulatorMs: 0,
    };
  }

  return {
    grid: clearedGrid,
    active: spawned,
    next: drawnNext,
    bag: bagAfterDraw,
    score: newScore,
    lines: newLines,
    level: newLevel,
    status: 'playing',
    gravityAccumulatorMs: 0,
  };
}

// ---------------------------------------------------------------------------
// Public reducers
// ---------------------------------------------------------------------------

/**
 * Build a fresh, playable `GameState`:
 *   - empty 10×22 grid
 *   - freshly shuffled 7-bag with the first two pieces drawn (active +
 *     next)
 *   - `status: 'playing'`, score/lines/level/accumulator all zeroed
 *
 * Inject `rng` to make the piece sequence deterministic in tests.
 */
export function createInitialState(rng: () => number = Math.random): GameState {
  const bag0 = createBag(rng);
  const { piece: activeKind, bag: bag1 } = drawFromBag(bag0, rng);
  const { piece: nextKind, bag: bag2 } = drawFromBag(bag1, rng);
  return {
    grid: emptyGrid(),
    active: spawnPiece(activeKind),
    next: nextKind,
    bag: bag2,
    score: 0,
    lines: 0,
    level: 0,
    status: 'playing',
    gravityAccumulatorMs: 0,
  };
}

/**
 * Translate the active piece one column to the left, rejecting the
 * move when it would collide with a wall or a locked cell. No-op when
 * the game is paused / over or there is no active piece.
 */
export function moveLeft(state: GameState): GameState {
  if (state.status !== 'playing' || state.active === null) return state;
  const candidate: Piece = { ...state.active, x: state.active.x - 1 };
  if (collides(state.grid, candidate)) return state;
  return { ...state, active: candidate };
}

/**
 * Mirror of `moveLeft`: translate the active piece one column to the
 * right, rejecting the move on collision.
 */
export function moveRight(state: GameState): GameState {
  if (state.status !== 'playing' || state.active === null) return state;
  const candidate: Piece = { ...state.active, x: state.active.x + 1 };
  if (collides(state.grid, candidate)) return state;
  return { ...state, active: candidate };
}

/**
 * Soft drop: nudge the active piece down by one row. On collision the
 * piece stays where it is — the game loop handles locking on the next
 * gravity tick, which keeps soft drop a pure "advance" action.
 */
export function softDrop(state: GameState): GameState {
  if (state.status !== 'playing' || state.active === null) return state;
  const candidate: Piece = { ...state.active, y: state.active.y + 1 };
  if (collides(state.grid, candidate)) return state;
  return { ...state, active: candidate };
}

/**
 * Hard drop: translate the active piece downward until the next step
 * would collide, lock it there, run `clearLines`, update score / lines
 * / level, then spawn the queued `next` piece (and refill the bag's
 * next slot). Triggers `status: 'gameover'` when the freshly spawned
 * piece collides immediately.
 *
 * `rng` is forwarded to the bag draw so deterministic tests stay
 * deterministic through a hard drop.
 */
export function hardDrop(
  state: GameState,
  rng: () => number = Math.random,
): GameState {
  if (state.status !== 'playing' || state.active === null) return state;
  let resting: Piece = state.active;
  for (;;) {
    const next: Piece = { ...resting, y: resting.y + 1 };
    if (collides(state.grid, next)) break;
    resting = next;
  }
  const lockedGrid = lockPiece(state.grid, resting);
  // `state` is passed through unchanged here — `lockAndSpawn` reads
  // `state.next`, `state.bag`, `state.level`, `state.lines`, `state.score`,
  // none of which we've mutated; it does NOT read `state.active` because
  // the locked piece is already baked into `lockedGrid`.
  return lockAndSpawn(state, lockedGrid, rng);
}

/**
 * Attempt to rotate the active piece clockwise via the SRS rotation
 * helper (which already handles wall kicks and no-ops on full
 * collision). Pure pass-through.
 */
export function rotateCW(state: GameState): GameState {
  if (state.status !== 'playing' || state.active === null) return state;
  const rotated = rotateActiveCW(state.grid, state.active);
  return { ...state, active: rotated };
}

/** Counter-clockwise mirror of {@link rotateCW}. */
export function rotateCCW(state: GameState): GameState {
  if (state.status !== 'playing' || state.active === null) return state;
  const rotated = rotateActiveCCW(state.grid, state.active);
  return { ...state, active: rotated };
}

/**
 * Advance gravity by `dtMs` milliseconds.
 *
 * Behaviour:
 *   - No-op when paused, over, or there is no active piece.
 *   - Adds `dtMs` to the gravity accumulator.
 *   - While the accumulator clears `gravityIntervalMs(level)`, attempts
 *     a 1-row drop. A successful drop just consumes one interval and
 *     loops. A collision triggers `lockAndSpawn` (line clear + scoring
 *     + spawn + game-over detection), which resets the accumulator;
 *     `tick` returns immediately after locking — any leftover dt is
 *     intentionally discarded so the player gets a fresh tick window
 *     with the new piece.
 *
 * `rng` is forwarded to the bag draw when a lock-and-spawn fires.
 */
export function tick(
  state: GameState,
  dtMs: number,
  rng: () => number = Math.random,
): GameState {
  if (state.status !== 'playing' || state.active === null) return state;

  let acc = state.gravityAccumulatorMs + dtMs;
  let active: Piece = state.active;
  const interval = gravityIntervalMs(state.level);

  while (acc >= interval) {
    acc -= interval;
    const next: Piece = { ...active, y: active.y + 1 };
    if (!collides(state.grid, next)) {
      active = next;
      continue;
    }
    // Collision: lock the resting piece and run the shared
    // clear/score/spawn tail. Pass the *current* active so lockPiece
    // sees the position we actually came to rest at.
    const lockedGrid = lockPiece(state.grid, active);
    return lockAndSpawn(state, lockedGrid, rng);
  }

  return { ...state, active, gravityAccumulatorMs: acc };
}

/**
 * Flip between `playing` and `paused`. Game-over states are sticky —
 * pausing a finished game does nothing.
 */
export function togglePause(state: GameState): GameState {
  if (state.status === 'playing') return { ...state, status: 'paused' };
  if (state.status === 'paused') return { ...state, status: 'playing' };
  return state;
}

/**
 * Restart: discard the current state entirely and return a freshly
 * initialised `GameState`. The current state is kept as a parameter
 * to match the reducer-action signature (`(state, ...args) => state`),
 * even though its contents are intentionally ignored.
 */
export function restart(
  _state: GameState,
  rng: () => number = Math.random,
): GameState {
  return createInitialState(rng);
}
