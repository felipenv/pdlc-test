// Calculator state selectors.
//
// Pure, read-only functions that derive display values from the
// canonical state shape produced by `./state.js`. The UI re-render layer
// calls these instead of poking at state fields directly, which keeps
// view-formatting concerns (padding, defaults, annunciator label order)
// out of the transition helpers.

const ALL_ANNUNCIATOR_KEYS = ['BUSY', 'PRG', 'HALT', 'IO', '<<>>'];

/**
 * Return the top `n` stack levels, newest-first, padded with `null`
 * when the stack is shorter than `n`.
 *
 * The HP 50G display lists the top four stack levels as `1:` (newest)
 * through `4:` (oldest of the visible window) — hence the default of 4.
 *
 * @param {{ stack: Array<number|string> }} state
 * @param {number} [n=4]
 * @returns {Array<number|string|null>}
 */
export function selectTopStackLevels(state, n = 4) {
  const stack = state.stack;
  const result = [];
  for (let i = 0; i < n; i += 1) {
    const idx = stack.length - 1 - i;
    result.push(idx >= 0 ? stack[idx] : null);
  }
  return result;
}

/**
 * Return the user-facing entry-buffer string.
 *
 * Shows `'0'` when the buffer is empty so the LCD always has something
 * to render in the entry row; otherwise returns the raw buffer so the
 * user can see exactly what they have typed (including a trailing '.',
 * a leading '-', a pending 'E', etc.).
 *
 * @param {{ entry: string }} state
 * @returns {string}
 */
export function selectEntryDisplay(state) {
  if (state.entry.length === 0) {
    return '0';
  }
  return state.entry;
}

/**
 * Return the ordered list of annunciator labels to render in the LCD's
 * status row.
 *
 * Labels are derived from `state.shift`, `state.angleMode`,
 * `state.entryMode`, and any boolean flags set on `state.annunciators`
 * (e.g. `{ BUSY: true }`). Order is fixed: shift first (left/right
 * arrow or 'ALPHA'), then angle mode, then entry mode (only when ALG —
 * RPN is the default and is implied), then any custom flags in the
 * documented HP 50G order.
 *
 * @param {{
 *   shift: 'none'|'left'|'right'|'alpha',
 *   angleMode: 'DEG'|'RAD'|'GRAD',
 *   entryMode: 'RPN'|'ALG',
 *   annunciators: Record<string, boolean>
 * }} state
 * @returns {string[]}
 */
export function selectAnnunciators(state) {
  const labels = [];

  if (state.shift === 'left') {
    labels.push('LEFT');
  } else if (state.shift === 'right') {
    labels.push('RIGHT');
  } else if (state.shift === 'alpha') {
    labels.push('ALPHA');
  }

  labels.push(state.angleMode);

  if (state.entryMode === 'ALG') {
    labels.push('ALG');
  }

  const flags = state.annunciators || {};
  for (const key of ALL_ANNUNCIATOR_KEYS) {
    if (flags[key]) {
      labels.push(key);
    }
  }

  return labels;
}
