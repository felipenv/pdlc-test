// HP 50G Calculator — scaffold entry point.
//
// This file intentionally has no imports yet. Subsequent stories will import
// the engine, UI, input, and constants modules from src/engine/, src/ui/,
// src/input/, and src/constants/. For now it just mounts a placeholder node
// inside the #calculator-root container declared in index.html so the page
// loads cleanly when opened directly in a desktop browser via file://.

const root = document.getElementById("calculator-root");

if (root) {
  const placeholder = document.createElement("div");
  placeholder.className = "calculator-placeholder";
  placeholder.textContent = "HP 50G Calculator — scaffold ready.";
  root.appendChild(placeholder);
}
