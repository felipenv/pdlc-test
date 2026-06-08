// HP 50G Calculator — entry point.
//
// Builds the faceplate DOM (dark casing housing the display and the keypad),
// then renders the keypad from the declarative `KEYPAD_ROWS` layout.
//
// The `onKey` callback is a no-op stub for this story. A later story (the
// input/command dispatcher) will wire it to actual command handling.

import { KEYPAD_ROWS } from "./constants/keys.js";
import { renderKeypad } from "./ui/keypad.js";

const root = document.getElementById("calculator-root");

if (root) {
  root.replaceChildren();

  const faceplate = document.createElement("div");
  faceplate.className = "faceplate";

  const display = document.createElement("div");
  display.className = "display";
  faceplate.appendChild(display);

  const keypad = document.createElement("div");
  keypad.className = "keypad";
  faceplate.appendChild(keypad);

  root.appendChild(faceplate);

  // The dispatcher story replaces this no-op with real command handling.
  const onKey = (_descriptor) => {
    /* no-op until the dispatcher story wires this up */
  };

  renderKeypad(keypad, KEYPAD_ROWS, onKey);
}
