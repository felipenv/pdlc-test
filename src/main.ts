// Entry point — the single side-effecting module of the app.
//
// `index.html` loads this file as an ES module. Its job is to:
//   1. Resolve the DOM nodes declared in the markup (the playfield and
//      next-piece canvases plus the score/lines/level HUD spans, with an
//      optional game-over banner).
//   2. Hold the live `GameState` in a closure with simple
//      `getState`/`setState` helpers — every other module is pure and
//      receives those helpers by reference.
//   3. Wire the renderer, the keyboard input layer, and the game loop
//      together and start play.
//
// `initGame()` returns a teardown function that detaches the input
// listener and cancels the active rAF handle. It is mainly useful for
// HMR / tests; the page itself never invokes it.
//
// All DOM access, `window` listeners, and `requestAnimationFrame` usage
// live in (or are delegated from) this module. The other modules accept
// the surfaces they need as arguments, keeping them pure and testable.

import { bindInput } from './input';
import { startLoop } from './loop';
import { createInitialState } from './logic/reducer';
import { createRenderer } from './render';
import type { GameState } from './types';

/**
 * Helper that resolves a required element by ID with a clear error
 * message when the element is missing. Surfaces wiring bugs at boot
 * instead of letting the renderer throw on a null reference later.
 */
function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) {
    throw new Error(`initGame: required element #${id} not found in DOM`);
  }
  return el as T;
}

/**
 * Boot the Tetris game against the DOM declared in `index.html`.
 *
 * Returns a teardown function that detaches the input listener and
 * stops the animation loop. Calling it more than once is safe.
 */
export function initGame(): () => void {
  const playfield = requireElement<HTMLCanvasElement>('playfield');
  const next = requireElement<HTMLCanvasElement>('next');
  const scoreEl = requireElement<HTMLElement>('score');
  const linesEl = requireElement<HTMLElement>('lines');
  const levelEl = requireElement<HTMLElement>('level');
  // #gameover is intentionally optional — the renderer falls back to a
  // canvas overlay when it's absent. With `exactOptionalPropertyTypes`
  // enabled, the renderer's `gameoverEl?: HTMLElement` cannot accept an
  // explicit `undefined`, so we omit the key entirely when missing via a
  // conditional spread below.
  const gameoverEl = document.getElementById('gameover');

  // Closure-held state. `setState` is the single mutation point; every
  // other module reads/writes via the function pair, never the variable
  // directly.
  let state: GameState = createInitialState();
  const getState = (): GameState => state;
  const setState = (nextState: GameState): void => {
    state = nextState;
  };

  const renderer = createRenderer({
    playfield,
    next,
    scoreEl,
    linesEl,
    levelEl,
    ...(gameoverEl !== null ? { gameoverEl } : {}),
  });

  const unbindInput = bindInput(getState, setState);
  const stopLoop = startLoop({
    getState,
    setState,
    draw: renderer.draw,
  });

  return function teardown(): void {
    unbindInput();
    stopLoop();
  };
}

// Boot on module load. The script tag in `index.html` lives at the end
// of `<body>` so the DOM is already parsed by the time this runs in
// practice; the readyState guard is cheap insurance against future
// reshuffling (e.g. moving the tag into `<head>` with `defer`).
if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      initGame();
    },
    { once: true },
  );
} else {
  initGame();
}
