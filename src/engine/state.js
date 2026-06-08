// Calculator state model.
//
// Single source of truth for the HP 50G calculator's runtime state, plus
// the pure transition helpers that mutate it. Every helper returns a
// brand-new state object (and a new `stack` / `entry` reference whenever
// those fields change) so the UI re-render layer can use cheap reference
// equality to decide what to redraw.
//
// The selectors that derive display values from state live in
// `./selectors.js`; this module re-exports them at the bottom so callers
// can import everything from a single surface (`./state.js`) when that's
// more convenient.
//
// Allowed value sets (validated by setters):
//   shift     : 'none' | 'left' | 'right' | 'alpha'
//   angleMode : 'DEG'  | 'RAD'  | 'GRAD'
//   entryMode : 'RPN'  | 'ALG'
//
// Entry buffer grammar (accepted by appendEntry):
//   - digits 0–9
//   - one '.' per segment (mantissa segment, exponent segment)
//   - one 'E' total, only after at least one mantissa digit
//   - '+/-' sign toggle: flips the leading '-' of the active segment
//     (mantissa when no 'E', exponent once 'E' is present)
//   Any other character is rejected (returns the state unchanged).

const VALID_SHIFTS = ['none', 'left', 'right', 'alpha'];
const VALID_ANGLE_MODES = ['DEG', 'RAD', 'GRAD'];
const VALID_ENTRY_MODES = ['RPN', 'ALG'];

/**
 * Factory for a fresh initial calculator state.
 *
 * Returns a brand-new object on every call so callers can safely mutate
 * it through the transition helpers without affecting other instances.
 *
 * Shape is fixed by the story spec:
 *   { stack: [], entry: '', shift: 'none', angleMode: 'DEG',
 *     entryMode: 'RPN', annunciators: {} }
 *
 * @returns {{
 *   stack: Array<number|string>,
 *   entry: string,
 *   shift: 'none'|'left'|'right'|'alpha',
 *   angleMode: 'DEG'|'RAD'|'GRAD',
 *   entryMode: 'RPN'|'ALG',
 *   annunciators: Record<string, boolean>
 * }}
 */
export function createInitialState() {
  return {
    stack: [],
    entry: '',
    shift: 'none',
    angleMode: 'DEG',
    entryMode: 'RPN',
    annunciators: {},
  };
}

// ---------------------------------------------------------------------------
// Shift state
// ---------------------------------------------------------------------------

/**
 * Set the shift modifier.
 * @param {object} state
 * @param {'none'|'left'|'right'|'alpha'} next
 * @returns {object} new state
 */
export function setShift(state, next) {
  if (!VALID_SHIFTS.includes(next)) {
    throw new Error(
      `setShift: invalid shift '${String(next)}'. ` +
        `Expected one of ${VALID_SHIFTS.join(', ')}.`,
    );
  }
  return { ...state, shift: next };
}

/**
 * Clear the shift modifier back to 'none'.
 * @param {object} state
 * @returns {object} new state
 */
export function clearShift(state) {
  return { ...state, shift: 'none' };
}

/**
 * Read the current shift and clear it in one atomic step.
 *
 * Used by the command dispatcher: it consumes the shift before applying
 * any non-shift transition so the modifier auto-clears after the next
 * keypress, matching the epic's acceptance criterion.
 *
 * @param {object} state
 * @returns {[object, 'none'|'left'|'right'|'alpha']} new state + consumed shift
 */
export function consumeShift(state) {
  return [{ ...state, shift: 'none' }, state.shift];
}

// ---------------------------------------------------------------------------
// Mode toggles
// ---------------------------------------------------------------------------

/**
 * Set the trigonometric angle mode.
 * @param {object} state
 * @param {'DEG'|'RAD'|'GRAD'} mode
 * @returns {object} new state
 */
export function setAngleMode(state, mode) {
  if (!VALID_ANGLE_MODES.includes(mode)) {
    throw new Error(
      `setAngleMode: invalid mode '${String(mode)}'. ` +
        `Expected one of ${VALID_ANGLE_MODES.join(', ')}.`,
    );
  }
  return { ...state, angleMode: mode };
}

/**
 * Set the entry mode (RPN vs algebraic).
 * @param {object} state
 * @param {'RPN'|'ALG'} mode
 * @returns {object} new state
 */
export function setEntryMode(state, mode) {
  if (!VALID_ENTRY_MODES.includes(mode)) {
    throw new Error(
      `setEntryMode: invalid mode '${String(mode)}'. ` +
        `Expected one of ${VALID_ENTRY_MODES.join(', ')}.`,
    );
  }
  return { ...state, entryMode: mode };
}

// ---------------------------------------------------------------------------
// Stack operations
// ---------------------------------------------------------------------------

/**
 * Push a value onto the top of the stack.
 * @param {object} state
 * @param {number|string} value
 * @returns {object} new state
 */
export function pushStack(state, value) {
  return { ...state, stack: [...state.stack, value] };
}

/**
 * Pop the top value off the stack.
 *
 * Returns a tuple of [nextState, poppedValue]. When the stack is empty,
 * the popped value is `null` and the state is returned unchanged (with a
 * new top-level reference, to keep the "always return new state"
 * invariant for callers that rely on reference equality).
 *
 * @param {object} state
 * @returns {[object, number|string|null]}
 */
export function popStack(state) {
  if (state.stack.length === 0) {
    return [{ ...state, stack: [] }, null];
  }
  const nextStack = state.stack.slice(0, -1);
  const popped = state.stack[state.stack.length - 1];
  return [{ ...state, stack: nextStack }, popped];
}

/**
 * Swap the top two stack levels. No-op when fewer than 2 levels exist.
 * @param {object} state
 * @returns {object} new state
 */
export function swapStack(state) {
  if (state.stack.length < 2) {
    return { ...state, stack: [...state.stack] };
  }
  const nextStack = state.stack.slice();
  const lastIndex = nextStack.length - 1;
  const top = nextStack[lastIndex];
  nextStack[lastIndex] = nextStack[lastIndex - 1];
  nextStack[lastIndex - 1] = top;
  return { ...state, stack: nextStack };
}

/**
 * Clear all values from the stack.
 * @param {object} state
 * @returns {object} new state
 */
export function clearStack(state) {
  return { ...state, stack: [] };
}

// ---------------------------------------------------------------------------
// Entry buffer
// ---------------------------------------------------------------------------

/**
 * Split the entry buffer into [mantissa, exponent].
 *
 * When no 'E' is present in the buffer, the exponent half is `null` and
 * callers know they are still editing the mantissa. Internal helper.
 *
 * @param {string} entry
 * @returns {[string, string|null]}
 */
function splitEntry(entry) {
  const eIndex = entry.indexOf('E');
  if (eIndex === -1) {
    return [entry, null];
  }
  return [entry.slice(0, eIndex), entry.slice(eIndex + 1)];
}

/**
 * Toggle the leading '-' of a segment (mantissa or exponent).
 *
 * Internal helper for the '+/-' branch of `appendEntry`. Skips a single
 * leading '.' so '.5' becomes '-.5' and back.
 *
 * @param {string} segment
 * @returns {string}
 */
function toggleSign(segment) {
  if (segment.startsWith('-')) {
    return segment.slice(1);
  }
  return `-${segment}`;
}

/**
 * Append a single character to the entry buffer.
 *
 * Accepted characters:
 *   - '0'-'9'      → digit; appended to the active segment
 *   - '.'          → one decimal point per segment; silently ignored if
 *                    the active segment already contains one
 *   - 'E'          → exponent marker; allowed at most once total, and
 *                    only after at least one digit has been entered
 *   - '+/-'        → toggles the leading '-' of the active segment
 *                    (mantissa when no 'E', exponent once 'E' is present)
 *
 * Any other character is rejected and the state is returned with a fresh
 * top-level reference but unchanged contents.
 *
 * @param {object} state
 * @param {string} char
 * @returns {object} new state
 */
export function appendEntry(state, char) {
  const { entry } = state;
  const [mantissa, exponent] = splitEntry(entry);
  const inExponent = exponent !== null;
  const activeSegment = inExponent ? exponent : mantissa;

  // Sign toggle on the active segment.
  if (char === '+/-') {
    const toggled = toggleSign(activeSegment);
    const nextEntry = inExponent ? `${mantissa}E${toggled}` : toggled;
    return { ...state, entry: nextEntry };
  }

  // Digit.
  if (char.length === 1 && char >= '0' && char <= '9') {
    return { ...state, entry: entry + char };
  }

  // Decimal point — at most one per segment.
  if (char === '.') {
    if (activeSegment.includes('.')) {
      return { ...state, entry };
    }
    return { ...state, entry: entry + '.' };
  }

  // Scientific-notation marker — at most one, and only after a digit.
  if (char === 'E') {
    if (inExponent) {
      return { ...state, entry };
    }
    if (!/[0-9]/.test(mantissa)) {
      return { ...state, entry };
    }
    return { ...state, entry: entry + 'E' };
  }

  // Unknown character — reject.
  return { ...state, entry };
}

/**
 * Remove the last character of the entry buffer.
 *
 * No-op when the buffer is already empty (returns a fresh top-level
 * state reference with the empty buffer preserved).
 *
 * @param {object} state
 * @returns {object} new state
 */
export function backspaceEntry(state) {
  if (state.entry.length === 0) {
    return { ...state, entry: '' };
  }
  return { ...state, entry: state.entry.slice(0, -1) };
}

/**
 * Commit the entry buffer onto the stack and clear it.
 *
 * Parses the buffer as a `Number` and pushes the parsed value. When the
 * buffer is empty, this is a no-op (returns a fresh top-level state
 * reference). When parsing fails (NaN), the raw string is pushed so the
 * caller can surface the error to the user without losing input.
 *
 * @param {object} state
 * @returns {object} new state
 */
export function commitEntry(state) {
  if (state.entry.length === 0) {
    return { ...state, stack: [...state.stack], entry: '' };
  }
  const parsed = Number(state.entry);
  const value = Number.isNaN(parsed) ? state.entry : parsed;
  return { ...state, stack: [...state.stack, value], entry: '' };
}

// ---------------------------------------------------------------------------
// Re-exported selectors (single import surface for callers)
// ---------------------------------------------------------------------------

export {
  selectTopStackLevels,
  selectEntryDisplay,
  selectAnnunciators,
} from './selectors.js';
