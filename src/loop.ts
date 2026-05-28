// Frame-rate-independent game loop driver.
//
// `startLoop` wires the pure reducer (`tick`) and the renderer together
// via `requestAnimationFrame`. Each frame:
//   1. Compute the wall-clock delta `dt` since the previous frame using
//      `performance.now()`.
//   2. While `status === 'playing'`, advance gravity by feeding `dt` to
//      `tick`. The reducer itself is a no-op for `paused` / `gameover`
//      states, but gating here keeps the intent explicit and avoids the
//      pointless setState call.
//   3. Always invoke `draw(getState())` — paused and gameover frames
//      must keep repainting so their overlays remain visible.
//   4. Schedule the next frame via `requestAnimationFrame`.
//
// `startLoop` returns a `stop` function. Calling it cancels the active
// `requestAnimationFrame` handle and is idempotent — additional calls
// are safe no-ops.

import { tick } from './logic/reducer';
import type { GameState } from './types';

/** Options accepted by {@link startLoop}. */
export interface StartLoopOptions {
  /** Read the current game state. */
  getState: () => GameState;
  /** Replace the current game state with a new value. */
  setState: (s: GameState) => void;
  /** Render the supplied state to the screen. */
  draw: (s: GameState) => void;
}

/**
 * Start the main animation loop.
 *
 * Returns a `stop` function that cancels the active rAF handle. Calling
 * `stop` more than once is safe — subsequent calls are no-ops.
 */
export function startLoop(opts: StartLoopOptions): () => void {
  const { getState, setState, draw } = opts;

  let lastTime = performance.now();
  let handle = 0;
  let stopped = false;

  const frame = (now: number): void => {
    if (stopped) return;
    const dt = now - lastTime;
    lastTime = now;

    if (getState().status === 'playing') {
      setState(tick(getState(), dt));
    }
    draw(getState());

    handle = requestAnimationFrame(frame);
  };

  handle = requestAnimationFrame(frame);

  return function stop(): void {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(handle);
  };
}
