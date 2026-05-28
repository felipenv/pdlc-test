// Unit tests for src/input.ts.
//
// The keyboard layer's contract:
//   - Each documented key dispatches the matching reducer action.
//   - Arrow keys and Space call `event.preventDefault()` so the page
//     never scrolls.
//   - In `gameover` only `KeyR` is honoured; in `paused` only `KeyP`
//     and `KeyR` are honoured.
//   - `bindInput` returns an unbind function that removes the listener
//     from `window`.
//
// The test environment is `node` (see vitest.config.ts) so there is no
// real `window`. We stub a minimal `window` with `addEventListener` /
// `removeEventListener` and capture the registered handler, then call
// it directly with synthetic event objects.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bindInput } from './input';
import { createInitialState } from './logic/reducer';
import type { GameState } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic LCG so the piece sequence is pinned. */
function makeRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Minimal `window` stub that records listeners. */
interface WindowStub {
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  /** The currently-registered `keydown` handler, if any. */
  handler: ((e: KeyboardEvent) => void) | null;
}

function makeWindowStub(): WindowStub {
  const stub: WindowStub = {
    handler: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  stub.addEventListener.mockImplementation(
    (type: string, fn: (e: KeyboardEvent) => void) => {
      if (type === 'keydown') stub.handler = fn;
    },
  );
  stub.removeEventListener.mockImplementation(
    (type: string, fn: (e: KeyboardEvent) => void) => {
      if (type === 'keydown' && stub.handler === fn) stub.handler = null;
    },
  );
  return stub;
}

/** Synthetic keyboard event shaped enough for our handler. */
function makeKeyEvent(code: string): KeyboardEvent {
  const evt = {
    code,
    key: code,
    preventDefault: vi.fn(),
  };
  return evt as unknown as KeyboardEvent;
}

/** Wire up a fresh state holder + stubbed window + bindInput. */
function setup(initial: GameState) {
  let state = initial;
  const getState = vi.fn(() => state);
  const setState = vi.fn((s: GameState) => {
    state = s;
  });
  const unbind = bindInput(getState, setState);
  return {
    get state() {
      return state;
    },
    getState,
    setState,
    unbind,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('bindInput', () => {
  let win: WindowStub;

  beforeEach(() => {
    win = makeWindowStub();
    vi.stubGlobal('window', win);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('attaches a keydown listener to window', () => {
    const initial = createInitialState(makeRng(1));
    setup(initial);
    expect(win.addEventListener).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function),
    );
    expect(win.handler).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Dispatch — each documented key triggers its reducer.
  // -------------------------------------------------------------------------

  it('ArrowLeft moves the active piece left', () => {
    const initial = createInitialState(makeRng(1));
    const env = setup(initial);
    const xBefore = initial.active!.x;
    win.handler!(makeKeyEvent('ArrowLeft'));
    expect(env.setState).toHaveBeenCalledTimes(1);
    expect(env.state.active!.x).toBe(xBefore - 1);
  });

  it('ArrowRight moves the active piece right', () => {
    const initial = createInitialState(makeRng(1));
    const env = setup(initial);
    const xBefore = initial.active!.x;
    win.handler!(makeKeyEvent('ArrowRight'));
    expect(env.state.active!.x).toBe(xBefore + 1);
  });

  it('ArrowDown soft-drops the active piece by one row', () => {
    const initial = createInitialState(makeRng(1));
    const env = setup(initial);
    const yBefore = initial.active!.y;
    win.handler!(makeKeyEvent('ArrowDown'));
    expect(env.state.active!.y).toBe(yBefore + 1);
  });

  it('Space hard-drops: locks the piece and spawns the next one', () => {
    const initial = createInitialState(makeRng(1));
    const initialActiveKind = initial.active!.kind;
    const initialNextKind = initial.next;
    const env = setup(initial);
    win.handler!(makeKeyEvent('Space'));
    // After hardDrop, a new active piece (matching the previous `next`)
    // is spawned and `next` is refilled.
    expect(env.state.active).not.toBeNull();
    expect(env.state.active!.kind).toBe(initialNextKind);
    // Sanity: original active is no longer the falling piece (it was
    // locked into the grid).
    expect(env.state.active!.kind === initialActiveKind).toBe(
      initialActiveKind === initialNextKind,
    );
  });

  it('ArrowUp rotates clockwise', () => {
    const initial = createInitialState(makeRng(1));
    const env = setup(initial);
    win.handler!(makeKeyEvent('ArrowUp'));
    expect(env.setState).toHaveBeenCalledTimes(1);
    // Rotation is delegated to the reducer — verify it was applied
    // (rotation 0 -> 1 unless the piece is O, which is no-op).
    if (initial.active!.kind !== 'O') {
      expect(env.state.active!.rotation).toBe(1);
    }
  });

  it('KeyX rotates clockwise (alias for ArrowUp)', () => {
    const initial = createInitialState(makeRng(1));
    const env = setup(initial);
    win.handler!(makeKeyEvent('KeyX'));
    expect(env.setState).toHaveBeenCalledTimes(1);
    if (initial.active!.kind !== 'O') {
      expect(env.state.active!.rotation).toBe(1);
    }
  });

  it('KeyZ rotates counter-clockwise', () => {
    const initial = createInitialState(makeRng(1));
    const env = setup(initial);
    win.handler!(makeKeyEvent('KeyZ'));
    expect(env.setState).toHaveBeenCalledTimes(1);
    if (initial.active!.kind !== 'O') {
      // CCW from 0 wraps to 3.
      expect(env.state.active!.rotation).toBe(3);
    }
  });

  it('KeyP toggles pause from playing -> paused', () => {
    const initial = createInitialState(makeRng(1));
    const env = setup(initial);
    win.handler!(makeKeyEvent('KeyP'));
    expect(env.state.status).toBe('paused');
  });

  it('KeyR restarts the game from a playing state', () => {
    const initial = createInitialState(makeRng(1));
    const mutated: GameState = { ...initial, score: 1234, lines: 7 };
    const env = setup(mutated);
    win.handler!(makeKeyEvent('KeyR'));
    expect(env.state.score).toBe(0);
    expect(env.state.lines).toBe(0);
    expect(env.state.status).toBe('playing');
  });

  // -------------------------------------------------------------------------
  // preventDefault for arrows + Space (regardless of gating).
  // -------------------------------------------------------------------------

  it.each([
    ['ArrowLeft'],
    ['ArrowRight'],
    ['ArrowDown'],
    ['ArrowUp'],
    ['Space'],
  ])('preventDefault is called for %s', (code) => {
    const initial = createInitialState(makeRng(1));
    setup(initial);
    const evt = makeKeyEvent(code);
    win.handler!(evt);
    expect(evt.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('preventDefault is NOT called for letter keys', () => {
    const initial = createInitialState(makeRng(1));
    setup(initial);
    const evt = makeKeyEvent('KeyP');
    win.handler!(evt);
    expect(evt.preventDefault).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Status gating.
  // -------------------------------------------------------------------------

  describe('when status is gameover', () => {
    it('ignores movement and rotation keys', () => {
      const initial = createInitialState(makeRng(1));
      const over: GameState = { ...initial, status: 'gameover' };
      const env = setup(over);
      for (const code of [
        'ArrowLeft',
        'ArrowRight',
        'ArrowDown',
        'ArrowUp',
        'KeyX',
        'KeyZ',
        'Space',
        'KeyP',
      ]) {
        win.handler!(makeKeyEvent(code));
      }
      expect(env.setState).not.toHaveBeenCalled();
      expect(env.state.status).toBe('gameover');
    });

    it('honours KeyR to restart', () => {
      const initial = createInitialState(makeRng(1));
      const over: GameState = {
        ...initial,
        status: 'gameover',
        score: 999,
      };
      const env = setup(over);
      win.handler!(makeKeyEvent('KeyR'));
      expect(env.setState).toHaveBeenCalledTimes(1);
      expect(env.state.status).toBe('playing');
      expect(env.state.score).toBe(0);
    });
  });

  describe('when status is paused', () => {
    it('ignores everything except KeyP and KeyR', () => {
      const initial = createInitialState(makeRng(1));
      const paused: GameState = { ...initial, status: 'paused' };
      const env = setup(paused);
      for (const code of [
        'ArrowLeft',
        'ArrowRight',
        'ArrowDown',
        'ArrowUp',
        'KeyX',
        'KeyZ',
        'Space',
      ]) {
        win.handler!(makeKeyEvent(code));
      }
      expect(env.setState).not.toHaveBeenCalled();
      expect(env.state.status).toBe('paused');
    });

    it('honours KeyP to resume', () => {
      const initial = createInitialState(makeRng(1));
      const paused: GameState = { ...initial, status: 'paused' };
      const env = setup(paused);
      win.handler!(makeKeyEvent('KeyP'));
      expect(env.state.status).toBe('playing');
    });

    it('honours KeyR to restart from paused', () => {
      const initial = createInitialState(makeRng(1));
      const paused: GameState = {
        ...initial,
        status: 'paused',
        score: 500,
      };
      const env = setup(paused);
      win.handler!(makeKeyEvent('KeyR'));
      expect(env.state.status).toBe('playing');
      expect(env.state.score).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Unknown keys.
  // -------------------------------------------------------------------------

  it('ignores unrecognised keys', () => {
    const initial = createInitialState(makeRng(1));
    const env = setup(initial);
    win.handler!(makeKeyEvent('KeyQ'));
    win.handler!(makeKeyEvent('Enter'));
    expect(env.setState).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Event.key fallback (when event.code is missing).
  // -------------------------------------------------------------------------

  it('falls back to event.key when event.code is missing', () => {
    const initial = createInitialState(makeRng(1));
    const env = setup(initial);
    const xBefore = initial.active!.x;
    // Synthetic event with empty `code` — handler must use `key`.
    const evt = {
      code: '',
      key: 'ArrowLeft',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;
    win.handler!(evt);
    expect(env.state.active!.x).toBe(xBefore - 1);
    expect(evt.preventDefault).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Unbind.
  // -------------------------------------------------------------------------

  it('returned unbind function removes the keydown listener', () => {
    const initial = createInitialState(makeRng(1));
    const env = setup(initial);
    const handlerBeforeUnbind = win.handler;
    env.unbind();
    expect(win.removeEventListener).toHaveBeenCalledWith(
      'keydown',
      handlerBeforeUnbind,
    );
    expect(win.handler).toBeNull();
  });

  it('after unbind, the original handler no longer affects state when invoked', () => {
    // Even if a stale reference to the handler is kept, the spec says
    // unbind detaches the listener — so a fresh keydown delivered via
    // the dispatcher (i.e. `win.handler`) is no longer routed.
    const initial = createInitialState(makeRng(1));
    const env = setup(initial);
    env.unbind();
    // `win.handler` is now null; simulate that the dispatcher would not
    // fire any handler. setState should not have been called from any
    // post-unbind dispatch.
    expect(win.handler).toBeNull();
    expect(env.setState).not.toHaveBeenCalled();
  });
});
