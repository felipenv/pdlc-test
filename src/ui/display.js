// HP 50G LCD-style display renderer.
//
// Exposes a single imperative entry point — `renderDisplay(rootEl, state)` —
// that projects the calculator state model onto a static DOM skeleton:
//
//   .lcd
//     .lcd-annunciators        (shift / angle / entry-mode flags)
//     .lcd-stack
//       .lcd-stack-row[4:]     (top, oldest visible)
//       .lcd-stack-row[3:]
//       .lcd-stack-row[2:]
//       .lcd-stack-row[1:]     (bottom, newest)
//     .lcd-entry               (current entry buffer / result / error)
//
// The first call to `renderDisplay` builds the skeleton inside `rootEl`
// and caches references to the leaf nodes on the root element under the
// `__lcd` property. Subsequent calls reuse the cached refs and only
// mutate `textContent` (and the `.lcd-error` class on the entry line)
// so that DOM diffing is cheap and stale text from a previous render is
// never left behind.
//
// All formatting concerns (annunciator label order, the `'0'` default
// for an empty entry buffer, the newest-first stack ordering) live in
// `../engine/selectors.js` — this module only relabels the selector
// output into HP 50G display order (4: top → 1: bottom) and wraps it in
// DOM nodes.

import {
  selectAnnunciators,
  selectEntryDisplay,
  selectTopStackLevels,
} from '../engine/selectors.js';

// HP 50G stack rows top-to-bottom. Index in `selectTopStackLevels(state, 4)`
// is newest-first, so row `1:` corresponds to index 0 of that array.
const STACK_ROWS = [
  { label: '4:', index: 3 },
  { label: '3:', index: 2 },
  { label: '2:', index: 1 },
  { label: '1:', index: 0 },
];

/**
 * Build the LCD skeleton inside `rootEl` and stash leaf-node refs on
 * `rootEl.__lcd` so subsequent renders can update `textContent` in place
 * without recreating any DOM.
 *
 * @param {HTMLElement} rootEl
 * @returns {{
 *   container: HTMLElement,
 *   annunciators: HTMLElement,
 *   stackValues: HTMLElement[],
 *   entry: HTMLElement,
 * }}
 */
function buildSkeleton(rootEl) {
  // Remove any pre-existing content (e.g. the scaffold placeholder) so
  // the LCD is the only thing inside `#calculator-root`.
  rootEl.textContent = '';

  const container = document.createElement('div');
  container.className = 'lcd';

  const annunciators = document.createElement('div');
  annunciators.className = 'lcd-annunciators';
  container.appendChild(annunciators);

  const stack = document.createElement('div');
  stack.className = 'lcd-stack';

  const stackValues = [];
  for (const { label } of STACK_ROWS) {
    const row = document.createElement('div');
    row.className = 'lcd-stack-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'lcd-stack-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'lcd-stack-value';
    valueEl.textContent = '';

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    stack.appendChild(row);
    stackValues.push(valueEl);
  }
  container.appendChild(stack);

  const entry = document.createElement('div');
  entry.className = 'lcd-entry';
  container.appendChild(entry);

  rootEl.appendChild(container);

  const refs = { container, annunciators, stackValues, entry };
  rootEl.__lcd = refs;
  return refs;
}

/**
 * Format a single stack level for display.
 *
 * `null` (empty level) renders as an empty string so only the level
 * label is visible — the AC says "empty levels render the level label
 * only". Numbers fall back to `String(value)`; non-numeric strings
 * (e.g. parse-error tokens stashed by `commitEntry`) pass through
 * verbatim.
 *
 * @param {number|string|null} value
 * @returns {string}
 */
function formatStackValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

/**
 * Compute the text and `is-error` flag for the entry/command line.
 *
 * Resolution order matches the AC: error > most-recent result > current
 * entry buffer. Both `state.error` and `state.lastResult` are optional —
 * future stories will set them and this renderer must tolerate their
 * absence today.
 *
 * @param {object} state
 * @returns {{ text: string, isError: boolean }}
 */
function resolveEntryLine(state) {
  if (state.error) {
    return { text: String(state.error), isError: true };
  }
  if (state.lastResult !== undefined && state.lastResult !== null) {
    return { text: String(state.lastResult), isError: false };
  }
  return { text: selectEntryDisplay(state), isError: false };
}

/**
 * Render the calculator state to the LCD inside `rootEl`.
 *
 * Safe to call repeatedly with new state references — the skeleton is
 * built lazily on the first call and every subsequent call only mutates
 * the existing leaf nodes' text, so there is no flicker and no stale
 * content.
 *
 * @param {HTMLElement} rootEl   Container element (e.g. #calculator-root)
 * @param {object}     state     Calculator state from `createInitialState`
 */
export function renderDisplay(rootEl, state) {
  if (!rootEl) {
    return;
  }

  const refs = rootEl.__lcd || buildSkeleton(rootEl);

  // --- Annunciators ------------------------------------------------------
  //
  // Selector emits 'ALG' only in algebraic mode; the AC asks for an
  // explicit RPN/ALG flag, so we synthesise 'RPN' here when the state
  // says so. Shift labels are remapped to the short HP 50G annunciator
  // strings (LS / RS) — the selector returns LEFT/RIGHT/ALPHA which are
  // more verbose than what an LCD would show.
  const rawLabels = selectAnnunciators(state);
  const labels = rawLabels.map((label) => {
    if (label === 'LEFT') return 'LS';
    if (label === 'RIGHT') return 'RS';
    return label;
  });
  if (state.entryMode === 'RPN') {
    // Insert RPN right after the angle-mode label so the row reads
    // "[shift] DEG RPN [extra…]" — matches HP 50G annunciator order.
    const angleIndex = labels.findIndex((l) =>
      l === 'DEG' || l === 'RAD' || l === 'GRAD',
    );
    if (angleIndex >= 0) {
      labels.splice(angleIndex + 1, 0, 'RPN');
    } else {
      labels.push('RPN');
    }
  }

  refs.annunciators.textContent = '';
  for (const label of labels) {
    const span = document.createElement('span');
    span.className = 'lcd-annunciator';
    span.textContent = label;
    refs.annunciators.appendChild(span);
  }

  // --- Stack -------------------------------------------------------------
  const levels = selectTopStackLevels(state, 4);
  for (let i = 0; i < STACK_ROWS.length; i += 1) {
    const { index } = STACK_ROWS[i];
    refs.stackValues[i].textContent = formatStackValue(levels[index]);
  }

  // --- Entry line --------------------------------------------------------
  const { text, isError } = resolveEntryLine(state);
  refs.entry.textContent = text;
  if (isError) {
    refs.entry.classList.add('lcd-error');
  } else {
    refs.entry.classList.remove('lcd-error');
  }
}
