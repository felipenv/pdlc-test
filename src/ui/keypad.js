// HP 50G keypad renderer.
//
// `renderKeypad(rootEl, layout, onKey)` consumes the declarative key
// descriptors exported by `src/constants/keys.js` and produces an
// HP 50G-styled grid of clickable `<button>` elements.
//
// Each key descriptor is rendered as:
//
//   <button class="key" type="button" data-key-id="..." style="grid-column: span N">
//     <span class="label-lshift">…</span>   (top-left,   orange/red)
//     <span class="label-rshift">…</span>   (top-right,  cyan/blue)
//     <span class="label-primary">…</span>  (centre,     white)
//     <span class="label-alpha">…</span>    (bottom-right, light)
//   </button>
//
// The four label spans are ALWAYS appended, even when the descriptor field is
// the empty string, so that rows align vertically — the stylesheet uses a
// non-breaking-space `::before` on empty spans to preserve their height.
//
// Colours are driven entirely by `styles/keypad.css`; this module sets no
// inline colour styles. The only inline style applied is `grid-column` for
// keys whose `gridSpan > 1` (e.g. the wide ENTER key).
//
// Each button's `click` handler invokes `onKey(keyDescriptor)`. Touch events
// surface as synthetic clicks in every modern browser, so a single `click`
// listener covers both pointer and touch input.

/**
 * Render the keypad layout into the given root element.
 *
 * @param {HTMLElement} rootEl - container the keypad is mounted into. Its
 *   existing contents are cleared.
 * @param {readonly object[][]} layout - rows of key descriptors (e.g.
 *   `KEYPAD_ROWS` from `src/constants/keys.js`).
 * @param {(key: object) => void} onKey - invoked with the key descriptor
 *   whenever a key is clicked or tapped.
 */
export function renderKeypad(rootEl, layout, onKey) {
  if (!rootEl) {
    throw new Error('renderKeypad: rootEl is required');
  }
  if (!Array.isArray(layout)) {
    throw new Error('renderKeypad: layout must be an array of rows');
  }
  const callback = typeof onKey === 'function' ? onKey : () => {};

  // Clear any prior content (e.g. from a re-render).
  rootEl.replaceChildren();

  layout.forEach((row, rowIndex) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'keypad-row';
    rowEl.dataset.rowIndex = String(rowIndex);

    row.forEach((descriptor) => {
      rowEl.appendChild(buildKeyButton(descriptor, callback));
    });

    rootEl.appendChild(rowEl);
  });
}

/**
 * Build a single key button from a descriptor.
 *
 * @param {object} descriptor - the key descriptor.
 * @param {(key: object) => void} onKey
 * @returns {HTMLButtonElement}
 */
function buildKeyButton(descriptor, onKey) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'key';
  button.dataset.keyId = descriptor.id;

  const span = descriptor.gridSpan ?? 1;
  if (span > 1) {
    button.style.gridColumn = `span ${span}`;
  }

  // Order matters for visual layout (top labels first, primary in the
  // centre, alpha last). The CSS uses grid-template-areas so the explicit
  // DOM order does not strictly drive geometry, but keeping it consistent
  // helps screen readers and dev-tools inspection.
  button.appendChild(buildLabel('label-lshift', descriptor.leftShift));
  button.appendChild(buildLabel('label-rshift', descriptor.rightShift));
  button.appendChild(buildLabel('label-primary', descriptor.primary));
  button.appendChild(buildLabel('label-alpha', descriptor.alpha));

  button.addEventListener('click', () => onKey(descriptor));

  return button;
}

/**
 * Build a label span. Empty text is rendered as an empty span so the
 * stylesheet can reserve vertical space for it.
 *
 * @param {string} className
 * @param {string} text
 * @returns {HTMLSpanElement}
 */
function buildLabel(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text ?? '';
  return span;
}
