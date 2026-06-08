// Vitest suite for `src/ui/keypad.js`.
//
// The vitest config uses `environment: "node"`, so there is no real DOM.
// We hand-roll a minimal mock of `document.createElement` plus the
// element subset that `renderKeypad` actually touches:
//
//   * `appendChild`, `replaceChildren`
//   * `className`, `type`, `textContent`
//   * `dataset` and `style` plain objects
//   * `addEventListener('click', fn)` and a synthetic `click()` helper
//
// The renderer only does imperative DOM construction over those surfaces,
// so call-recording / introspection is sufficient to assert the contract.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderKeypad } from './keypad.js';
import { KEYPAD_ROWS } from '../constants/keys.js';

// ---------------------------------------------------------------------------
// DOM mocks
// ---------------------------------------------------------------------------

function makeElement(tag) {
  const children = [];
  const listeners = Object.create(null);
  const el = {
    tagName: String(tag).toUpperCase(),
    className: '',
    type: '',
    textContent: '',
    style: {},
    dataset: {},
    children,
    parent: null,
    appendChild(child) {
      children.push(child);
      child.parent = el;
      return child;
    },
    replaceChildren(...nodes) {
      children.length = 0;
      for (const n of nodes) {
        el.appendChild(n);
      }
    },
    addEventListener(name, fn) {
      (listeners[name] ??= []).push(fn);
    },
    /** Test helper — fire the registered click listeners. */
    click() {
      const fns = listeners.click ?? [];
      for (const fn of fns) fn({ type: 'click' });
    },
  };
  return el;
}

/** Recursively collect every descendant element in document (pre-order) order. */
function descendants(node) {
  const out = [];
  function walk(n) {
    if (!Array.isArray(n.children)) return;
    for (const child of n.children) {
      out.push(child);
      walk(child);
    }
  }
  walk(node);
  return out;
}

/** Filter elements by class name. */
function withClass(elements, className) {
  return elements.filter((e) => e.className === className);
}

beforeEach(() => {
  globalThis.document = {
    createElement: (tag) => makeElement(tag),
  };
});

afterEach(() => {
  delete globalThis.document;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('renderKeypad', () => {
  it('renders one .keypad-row per layout row with the right data-row-index', () => {
    const root = makeElement('div');
    renderKeypad(root, KEYPAD_ROWS, () => {});

    expect(root.children).toHaveLength(KEYPAD_ROWS.length);
    root.children.forEach((rowEl, idx) => {
      expect(rowEl.tagName).toBe('DIV');
      expect(rowEl.className).toBe('keypad-row');
      expect(rowEl.dataset.rowIndex).toBe(String(idx));
    });
  });

  it('renders a .key button for every key descriptor in the layout', () => {
    const root = makeElement('div');
    renderKeypad(root, KEYPAD_ROWS, () => {});

    const totalKeys = KEYPAD_ROWS.reduce((n, row) => n + row.length, 0);
    const allKeys = withClass(descendants(root), 'key');

    expect(allKeys).toHaveLength(totalKeys);
    for (const button of allKeys) {
      expect(button.tagName).toBe('BUTTON');
      expect(button.type).toBe('button');
      expect(typeof button.dataset.keyId).toBe('string');
      expect(button.dataset.keyId.length).toBeGreaterThan(0);
    }
  });

  it('gives every key four label spans with the documented classes', () => {
    const root = makeElement('div');
    renderKeypad(root, KEYPAD_ROWS, () => {});

    const allKeys = withClass(descendants(root), 'key');
    for (const button of allKeys) {
      const classes = button.children.map((c) => c.className);
      expect(classes).toEqual([
        'label-lshift',
        'label-rshift',
        'label-primary',
        'label-alpha',
      ]);
      // Every label is a <span>.
      for (const c of button.children) {
        expect(c.tagName).toBe('SPAN');
      }
    }
  });

  it('renders the descriptor texts into the matching label spans', () => {
    const root = makeElement('div');
    renderKeypad(root, KEYPAD_ROWS, () => {});

    const flatKeys = KEYPAD_ROWS.flat();
    const buttons = withClass(descendants(root), 'key');
    expect(buttons).toHaveLength(flatKeys.length);

    for (let i = 0; i < flatKeys.length; i++) {
      const desc = flatKeys[i];
      const btn = buttons[i];
      const [lshift, rshift, primary, alpha] = btn.children;
      expect(lshift.textContent).toBe(desc.leftShift);
      expect(rshift.textContent).toBe(desc.rightShift);
      expect(primary.textContent).toBe(desc.primary);
      expect(alpha.textContent).toBe(desc.alpha);
      expect(btn.dataset.keyId).toBe(desc.id);
    }
  });

  it('applies inline grid-column span only for keys with gridSpan > 1 (e.g. ENTER)', () => {
    const root = makeElement('div');
    renderKeypad(root, KEYPAD_ROWS, () => {});

    const buttons = withClass(descendants(root), 'key');
    const enterDesc = KEYPAD_ROWS.flat().find((k) => k.id === 'enter');
    expect(enterDesc).toBeDefined();
    expect(enterDesc.gridSpan).toBe(2);

    const enterBtn = buttons.find((b) => b.dataset.keyId === 'enter');
    expect(enterBtn.style.gridColumn).toBe('span 2');

    // A span-1 key should not have an inline gridColumn override.
    const oneSpanBtn = buttons.find((b) => b.dataset.keyId === 'f1');
    expect(oneSpanBtn.style.gridColumn).toBeUndefined();
  });

  it('invokes onKey with the descriptor when a key is clicked', () => {
    const root = makeElement('div');
    const onKey = vi.fn();
    renderKeypad(root, KEYPAD_ROWS, onKey);

    const buttons = withClass(descendants(root), 'key');
    const enterDesc = KEYPAD_ROWS.flat().find((k) => k.id === 'enter');
    const enterBtn = buttons.find((b) => b.dataset.keyId === 'enter');

    enterBtn.click();
    expect(onKey).toHaveBeenCalledTimes(1);
    expect(onKey).toHaveBeenCalledWith(enterDesc);

    const f1Desc = KEYPAD_ROWS.flat().find((k) => k.id === 'f1');
    const f1Btn = buttons.find((b) => b.dataset.keyId === 'f1');
    f1Btn.click();
    expect(onKey).toHaveBeenCalledTimes(2);
    expect(onKey).toHaveBeenLastCalledWith(f1Desc);
  });

  it('clears the root before re-rendering', () => {
    const root = makeElement('div');
    // Seed the root with stale content.
    root.appendChild(makeElement('span'));
    root.appendChild(makeElement('span'));
    expect(root.children).toHaveLength(2);

    renderKeypad(root, KEYPAD_ROWS, () => {});

    // Only the keypad rows should remain.
    expect(root.children).toHaveLength(KEYPAD_ROWS.length);
    for (const row of root.children) {
      expect(row.className).toBe('keypad-row');
    }
  });

  it('tolerates a missing onKey callback (defaults to a no-op)', () => {
    const root = makeElement('div');
    expect(() => renderKeypad(root, KEYPAD_ROWS)).not.toThrow();

    const enterBtn = withClass(descendants(root), 'key').find(
      (b) => b.dataset.keyId === 'enter',
    );
    expect(() => enterBtn.click()).not.toThrow();
  });

  it('throws when rootEl is missing or layout is not an array', () => {
    expect(() => renderKeypad(null, KEYPAD_ROWS, () => {})).toThrow(/rootEl/);
    const root = makeElement('div');
    expect(() => renderKeypad(root, 'not-an-array', () => {})).toThrow(/array/);
  });
});
