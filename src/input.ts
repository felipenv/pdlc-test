// Keyboard input layer.
//
// Translates `keydown` events on `window` into reducer-action calls
// against a mutable state holder. The state holder is supplied by the
// caller through the `getState` / `setState` pair so this module stays
// agnostic of where the state actually lives (a module-level variable
// in the game loop, a React `useState` setter, a custom store — all
// fine).
//
// Behaviour highlights:
//   - Switches on `event.code` (preferred — layout-independent) and
//     falls back to `event.key` so unusual keyboards still work.
//   - Calls `event.preventDefault()` for arrow keys and `Space`
//     regardless of whether the action ran, so the page never scrolls
//     while the game has focus.
//   - Gates input by `state.status`: when `gameover`, only `KeyR`
//     restarts; when `paused`, only `KeyP` (resume) and `KeyR` are
//     honoured. All other keys are ignored in those states (the
//     reducers themselves also no-op there, but gating here saves a
//     redundant `setState` call and matches the spec).
//   - Returns an unbind function that detaches the listener — the
//     caller is expected to invoke it on teardown.

import {
  hardDrop,
  moveLeft,
  moveRight,
  restart,
  rotateCCW,
  rotateCW,
  softDrop,
  togglePause,
} from './logic/reducer';
import type { GameState } from './types';

/** Codes for which we always call `preventDefault` to avoid page scroll. */
const PREVENT_DEFAULT_CODES: ReadonlySet<string> = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowDown',
  'ArrowUp',
  'Space',
]);

/**
 * Bind keyboard handlers to `window` and return an unbind function.
 *
 * @param getState - reader for the current game state (called fresh on
 *   every keydown so we always see the latest status).
 * @param setState - writer that replaces the current game state with the
 *   reducer's result.
 * @returns a function that, when called, removes the `keydown` listener
 *   from `window`.
 */
export function bindInput(
  getState: () => GameState,
  setState: (s: GameState) => void,
): () => void {
  const handler = (event: KeyboardEvent): void => {
    // Prefer `event.code` (physical key, layout-independent). Fall back
    // to `event.key` for environments / synthetic events that don't set
    // `code`.
    const code = event.code || event.key;

    if (PREVENT_DEFAULT_CODES.has(code)) {
      event.preventDefault();
    }

    const state = getState();

    // Gate by lifecycle: gameover only honours restart; paused only
    // honours pause-toggle (resume) and restart.
    if (state.status === 'gameover' && code !== 'KeyR') return;
    if (
      state.status === 'paused' &&
      code !== 'KeyP' &&
      code !== 'KeyR'
    ) {
      return;
    }

    switch (code) {
      case 'ArrowLeft':
        setState(moveLeft(state));
        return;
      case 'ArrowRight':
        setState(moveRight(state));
        return;
      case 'ArrowDown':
        setState(softDrop(state));
        return;
      case 'Space':
        setState(hardDrop(state));
        return;
      case 'ArrowUp':
      case 'KeyX':
        setState(rotateCW(state));
        return;
      case 'KeyZ':
        setState(rotateCCW(state));
        return;
      case 'KeyP':
        setState(togglePause(state));
        return;
      case 'KeyR':
        setState(restart(state));
        return;
      default:
        // Unrecognised key — ignore.
        return;
    }
  };

  window.addEventListener('keydown', handler);
  return () => {
    window.removeEventListener('keydown', handler);
  };
}
