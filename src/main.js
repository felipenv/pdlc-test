// HP 50G Calculator — entry point.
//
// Boots the calculator UI by constructing a fresh state model and
// projecting it onto the LCD display inside `#calculator-root`. This
// story (LCD display) only renders the initial state on load — the
// input dispatcher, command engine, and event wiring are added by
// follow-up stories. When those land, they will re-call
// `renderDisplay(root, newState)` after every transition; the display
// renderer already guarantees that's flicker-free and stale-text-free.

import { createInitialState } from "./engine/state.js";
import { renderDisplay } from "./ui/display.js";

const root = document.getElementById("calculator-root");

if (root) {
  const state = createInitialState();
  renderDisplay(root, state);
}
