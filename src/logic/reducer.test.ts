// Unit tests for src/logic/reducer.ts.
//
// Verifies the contracts described in the reducer's docstrings:
//   - `createInitialState` produces a valid playing state.
//   - Movement / soft-drop / hard-drop respect collisions.
//   - Hard-drop and gravity-driven `tick` lock the active piece,
//     clear lines, update score / lines / level, and detect game-over
//     on spawn collision.
//   - Pause halts `tick`; restart returns a fresh initial state.
//   - Every reducer is pure: input states are never mutated.

import { describe, expect, it } from 'vitest';

import { BOARD_HEIGHT_TOTAL, BOARD_WIDTH } from '../constants';
import type { GameState, Grid } from '../types';

import {
  createInitialState,
  hardDrop,
  moveLeft,
  moveRight,
  restart,
  rotateCCW,
  rotateCW,
  softDrop,
  tick,
  togglePause,
} from './reducer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Linear-congruential RNG seeded by `seed`. Deterministic — same seed
 * yields the same sequence in `[0, 1)`. Used wherever a test wants a
 * reproducible bag shuffle.
 */
function makeRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function emptyGrid(): Grid {
  return Array.from({ length: BOARD_HEIGHT_TOTAL }, () =>
    Array.from({ length: BOARD_WIDTH }, () => null),
  );
}

function snapshot(state: GameState): string {
  return JSON.stringify(state);
}

/** Deterministic helper to find a seed whose initial active piece is NOT 'O'. */
function findStateWithNonO(): GameState {
  for (let seed = 1; seed < 500; seed += 1) {
    const s = createInitialState(makeRng(seed));
    if (s.active !== null && s.active.kind !== 'O') return s;
  }
  throw new Error('Could not find non-O initial state');
}

// ---------------------------------------------------------------------------
// createInitialState
// ---------------------------------------------------------------------------

describe('createInitialState', () => {
  it('returns a playing state with active + queued pieces and zeroed counters', () => {
    const state = createInitialState(makeRng(1));
    expect(state.status).toBe('playing');
    expect(state.active).not.toBeNull();
    expect(state.active!.rotation).toBe(0);
    expect(state.next).toBeDefined();
    expect(state.score).toBe(0);
    expect(state.lines).toBe(0);
    expect(state.level).toBe(0);
    expect(state.gravityAccumulatorMs).toBe(0);
    // The fresh 7-bag had two pieces drawn (active + next).
    expect(state.bag.length).toBe(5);
  });

  it('produces an empty 22×10 grid', () => {
    const state = createInitialState(makeRng(2));
    expect(state.grid.length).toBe(BOARD_HEIGHT_TOTAL);
    state.grid.forEach((row) => {
      expect(row.length).toBe(BOARD_WIDTH);
      row.forEach((cell) => expect(cell).toBeNull());
    });
  });

  it('is deterministic when seeded with the same RNG state', () => {
    const a = createInitialState(makeRng(42));
    const b = createInitialState(makeRng(42));
    expect(a.active!.kind).toBe(b.active!.kind);
    expect(a.next).toBe(b.next);
    expect(a.bag).toEqual(b.bag);
  });

  it('spawns I/T/S/Z/J/L at x=3 and O at x=4 in the buffer rows', () => {
    for (let seed = 1; seed < 40; seed += 1) {
      const state = createInitialState(makeRng(seed));
      const kind = state.active!.kind;
      const expectedX = kind === 'O' ? 4 : 3;
      expect(state.active!.x).toBe(expectedX);
      expect(state.active!.y).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// moveLeft / moveRight
// ---------------------------------------------------------------------------

describe('moveLeft / moveRight', () => {
  it('shifts the active piece by ±1 column in open space', () => {
    const initial = createInitialState(makeRng(100));
    const x0 = initial.active!.x;
    expect(moveLeft(initial).active!.x).toBe(x0 - 1);
    expect(moveRight(initial).active!.x).toBe(x0 + 1);
  });

  it('rejects movement past the walls', () => {
    const initial = createInitialState(makeRng(101));
    // Slide left until we hit the wall, then assert one more attempt no-ops.
    let leftmost = initial;
    for (let i = 0; i < 20; i += 1) leftmost = moveLeft(leftmost);
    expect(moveLeft(leftmost)).toBe(leftmost);

    // Same, sliding right.
    let rightmost = initial;
    for (let i = 0; i < 20; i += 1) rightmost = moveRight(rightmost);
    expect(moveRight(rightmost)).toBe(rightmost);
  });

  it('is a no-op while paused', () => {
    const initial = createInitialState(makeRng(102));
    const paused = togglePause(initial);
    expect(moveLeft(paused)).toBe(paused);
    expect(moveRight(paused)).toBe(paused);
  });

  it('does not mutate the input state', () => {
    const initial = createInitialState(makeRng(103));
    const before = snapshot(initial);
    moveLeft(initial);
    moveRight(initial);
    expect(snapshot(initial)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// softDrop
// ---------------------------------------------------------------------------

describe('softDrop', () => {
  it('advances y by one in open space', () => {
    const initial = createInitialState(makeRng(200));
    const dropped = softDrop(initial);
    expect(dropped.active!.y).toBe(initial.active!.y + 1);
  });

  it('leaves the piece in place when blocked (no lock here)', () => {
    // O at y=20 covers rows 20-21; the next step (y=21) would push the
    // bottom row to 22, which collides with the floor.
    const state: GameState = {
      grid: emptyGrid(),
      active: { kind: 'O', rotation: 0, x: 4, y: 20 },
      next: 'T',
      bag: ['S', 'Z', 'J', 'L', 'I'],
      score: 0,
      lines: 0,
      level: 0,
      status: 'playing',
      gravityAccumulatorMs: 0,
    };
    const after = softDrop(state);
    expect(after.active).toEqual(state.active);
    expect(after.grid).toEqual(state.grid);
  });
});

// ---------------------------------------------------------------------------
// hardDrop
// ---------------------------------------------------------------------------

describe('hardDrop', () => {
  it('locks the active piece against the floor and spawns the queued next piece', () => {
    const state: GameState = {
      grid: emptyGrid(),
      active: { kind: 'O', rotation: 0, x: 4, y: 0 },
      next: 'T',
      bag: ['S', 'Z', 'J', 'L', 'I'],
      score: 0,
      lines: 0,
      level: 0,
      status: 'playing',
      gravityAccumulatorMs: 0,
    };
    const after = hardDrop(state, makeRng(7));
    // O's four cells now sit at rows 20-21, cols 4-5.
    expect(after.grid[20][4]).toBe('O');
    expect(after.grid[20][5]).toBe('O');
    expect(after.grid[21][4]).toBe('O');
    expect(after.grid[21][5]).toBe('O');
    // New active piece is what state.next was; bag head becomes the new next.
    expect(after.active!.kind).toBe('T');
    expect(after.next).toBe('S');
    expect(after.status).toBe('playing');
    expect(after.gravityAccumulatorMs).toBe(0);
  });

  it('triggers line clear and applies scoreFor when a row becomes complete', () => {
    // Pre-fill row 21 cols 4..9; hard-drop an I horizontally at x=0 to
    // fill cols 0..3 of row 21 and clear it (a single → 100 pts at level 0).
    const grid = emptyGrid();
    for (let x = 4; x < BOARD_WIDTH; x += 1) grid[21][x] = 'L';

    const state: GameState = {
      grid,
      active: { kind: 'I', rotation: 0, x: 0, y: 0 },
      next: 'O',
      bag: ['T', 'S', 'Z', 'J', 'L'],
      score: 0,
      lines: 0,
      level: 0,
      status: 'playing',
      gravityAccumulatorMs: 0,
    };
    const after = hardDrop(state, makeRng(7));
    expect(after.lines).toBe(1);
    expect(after.level).toBe(0);
    expect(after.score).toBe(100);
    expect(after.grid[21].every((cell) => cell === null)).toBe(true);
  });

  it('sets status to gameover when the freshly spawned piece collides', () => {
    // Block the spawn cells of the queued O piece (x=4..5, y=0..1).
    const grid = emptyGrid();
    grid[0][4] = 'I';
    grid[0][5] = 'I';
    grid[1][4] = 'I';
    grid[1][5] = 'I';

    const state: GameState = {
      grid,
      // T well clear of the obstruction; will fall to the floor and lock.
      active: { kind: 'T', rotation: 0, x: 0, y: 0 },
      next: 'O',
      bag: ['S', 'Z', 'J', 'L', 'I'],
      score: 0,
      lines: 0,
      level: 0,
      status: 'playing',
      gravityAccumulatorMs: 0,
    };
    const after = hardDrop(state, makeRng(7));
    expect(after.status).toBe('gameover');
    expect(after.active).toBeNull();
  });

  it('is a no-op while paused', () => {
    const initial = createInitialState(makeRng(300));
    const paused = togglePause(initial);
    expect(hardDrop(paused)).toBe(paused);
  });

  it('does not mutate the input state', () => {
    const initial = createInitialState(makeRng(301));
    const before = snapshot(initial);
    hardDrop(initial, makeRng(0));
    expect(snapshot(initial)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// rotateCW / rotateCCW
// ---------------------------------------------------------------------------

describe('rotateCW / rotateCCW', () => {
  it('advances rotation in open space and is reversed by the opposite rotate', () => {
    // O is identical in all four rotation states, so pick a state whose
    // active piece is not O.
    const state = findStateWithNonO();
    const r0 = state.active!.rotation;
    const cw = rotateCW(state);
    expect(cw.active!.rotation).toBe(((r0 + 1) & 3) as 0 | 1 | 2 | 3);
    const back = rotateCCW(cw);
    expect(back.active!.rotation).toBe(r0);
  });

  it('is a no-op while paused', () => {
    const initial = createInitialState(makeRng(400));
    const paused = togglePause(initial);
    expect(rotateCW(paused)).toBe(paused);
    expect(rotateCCW(paused)).toBe(paused);
  });
});

// ---------------------------------------------------------------------------
// tick
// ---------------------------------------------------------------------------

describe('tick', () => {
  it('only updates the accumulator when dtMs is below the gravity threshold', () => {
    const initial = createInitialState(makeRng(500));
    const after = tick(initial, 100, makeRng(0));
    expect(after.gravityAccumulatorMs).toBe(100);
    expect(after.active).toEqual(initial.active);
    expect(after.grid).toEqual(initial.grid);
  });

  it('drops the active piece one row when the accumulator crosses the threshold', () => {
    const initial = createInitialState(makeRng(501));
    // level 0 → 1000 ms per gravity step; dtMs == interval drops exactly one row.
    const after = tick(initial, 1000, makeRng(0));
    expect(after.active!.y).toBe(initial.active!.y + 1);
    expect(after.gravityAccumulatorMs).toBe(0);
  });

  it('locks, clears lines, and applies scoreFor atomically when the piece bottoms out', () => {
    const grid = emptyGrid();
    for (let x = 4; x < BOARD_WIDTH; x += 1) grid[21][x] = 'L';

    const state: GameState = {
      grid,
      // I horizontally at y=20 → cells fill row 21 cols 0..3. One more
      // y+1 would overflow → collision → lock.
      active: { kind: 'I', rotation: 0, x: 0, y: 20 },
      next: 'O',
      bag: ['T', 'S', 'Z', 'J', 'L'],
      score: 0,
      lines: 0,
      level: 0,
      status: 'playing',
      gravityAccumulatorMs: 0,
    };
    const after = tick(state, 1000, makeRng(7));
    expect(after.lines).toBe(1);
    expect(after.score).toBe(100);
    expect(after.active!.kind).toBe('O');
    expect(after.next).toBe('T');
    expect(after.status).toBe('playing');
    expect(after.gravityAccumulatorMs).toBe(0);
    // Row 21 is now empty (cleared by the tetris helper).
    expect(after.grid[21].every((cell) => cell === null)).toBe(true);
  });

  it('sets status to gameover when locking yields a spawn collision', () => {
    const grid = emptyGrid();
    // Block the spawn cells of the queued O piece.
    grid[0][4] = 'I';
    grid[0][5] = 'I';
    grid[1][4] = 'I';
    grid[1][5] = 'I';

    const state: GameState = {
      grid,
      active: { kind: 'T', rotation: 0, x: 0, y: 19 }, // will lock at y=20
      next: 'O',
      bag: ['S', 'Z', 'J', 'L', 'I'],
      score: 0,
      lines: 0,
      level: 0,
      status: 'playing',
      gravityAccumulatorMs: 0,
    };
    // Large dtMs to ensure the tick locks the piece.
    const after = tick(state, 5000, makeRng(7));
    expect(after.status).toBe('gameover');
    expect(after.active).toBeNull();
  });

  it('is a no-op while paused', () => {
    const initial = createInitialState(makeRng(502));
    const paused = togglePause(initial);
    expect(tick(paused, 5000, makeRng(0))).toBe(paused);
  });

  it('is a no-op once the game is over', () => {
    const game: GameState = {
      ...createInitialState(makeRng(503)),
      status: 'gameover',
      active: null,
    };
    expect(tick(game, 5000, makeRng(0))).toBe(game);
  });

  it('does not mutate the input state', () => {
    const initial = createInitialState(makeRng(504));
    const before = snapshot(initial);
    tick(initial, 1500, makeRng(0));
    expect(snapshot(initial)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// togglePause
// ---------------------------------------------------------------------------

describe('togglePause', () => {
  it('flips playing → paused → playing', () => {
    const initial = createInitialState(makeRng(600));
    const paused = togglePause(initial);
    expect(paused.status).toBe('paused');
    const resumed = togglePause(paused);
    expect(resumed.status).toBe('playing');
  });

  it('does nothing when the game is over', () => {
    const game: GameState = {
      ...createInitialState(makeRng(601)),
      status: 'gameover',
      active: null,
    };
    expect(togglePause(game)).toBe(game);
  });
});

// ---------------------------------------------------------------------------
// restart
// ---------------------------------------------------------------------------

describe('restart', () => {
  it('returns a fresh initial state regardless of the previous state', () => {
    const dirty: GameState = {
      ...createInitialState(makeRng(700)),
      score: 1234,
      lines: 12,
      level: 5,
      status: 'gameover',
      active: null,
    };
    const fresh = restart(dirty, makeRng(700));
    expect(fresh.status).toBe('playing');
    expect(fresh.score).toBe(0);
    expect(fresh.lines).toBe(0);
    expect(fresh.level).toBe(0);
    expect(fresh.active).not.toBeNull();
    expect(fresh.gravityAccumulatorMs).toBe(0);
    expect(fresh.grid.every((row) => row.every((c) => c === null))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cross-reducer immutability sweep
// ---------------------------------------------------------------------------

describe('input-state immutability', () => {
  it('no reducer mutates its input state', () => {
    const initial = createInitialState(makeRng(800));
    const before = snapshot(initial);
    moveLeft(initial);
    moveRight(initial);
    softDrop(initial);
    hardDrop(initial, makeRng(0));
    rotateCW(initial);
    rotateCCW(initial);
    tick(initial, 100, makeRng(0));
    tick(initial, 1000, makeRng(0));
    tick(initial, 5000, makeRng(0));
    togglePause(initial);
    restart(initial, makeRng(0));
    expect(snapshot(initial)).toBe(before);
  });
});
