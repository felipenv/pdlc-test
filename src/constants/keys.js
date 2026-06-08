// HP 50G keypad layout and key metadata.
//
// This module is the declarative source of truth consumed by:
//
//   * The keypad renderer (CSS-grid). It reads the rows in order and uses
//     each key's `gridSpan` to size cells horizontally; the row index is
//     implicit in the array order.
//   * The input dispatcher. It maps physical keyboard events
//     (`KeyboardEvent.key`) to a key descriptor via `keyboardKeys`, then
//     resolves the active modifier (none / LSHIFT / RSHIFT / ALPHA) to one of
//     `command`, `leftCommand`, `rightCommand`, or — when the modifier is
//     ALPHA — `alphaChar` (entered as a literal character).
//
// Each key descriptor has the following shape:
//
//   {
//     id            : string  // unique identifier, kebab-case
//     primary       : string  // legend printed on the key cap (e.g. "ENTER", "7")
//     leftShift     : string  // legend printed above-left in orange/red
//     rightShift    : string  // legend printed above-right in cyan/blue
//     alpha         : string  // legend printed bottom-right for ALPHA mode
//     gridSpan      : number  // CSS-grid column span (default 1)
//     command       : string|null  // command id fired on un-shifted press
//     leftCommand   : string|null  // command id fired after LSHIFT
//     rightCommand  : string|null  // command id fired after RSHIFT
//     alphaChar     : string  // literal character emitted in ALPHA mode
//     keyboardKeys  : string[]  // physical KeyboardEvent.key values that map here
//   }
//
// Empty string ("") means the legend / alpha char is absent; `null` means no
// command is bound for that modifier slot.
//
// Command id conventions (resolved at dispatch time, not in this file):
//
//   shift.left / shift.right / shift.alpha   — toggle modifier state
//   stack.enter / stack.drop / stack.swap / stack.clear — RPN stack ops
//   cursor.up / cursor.down / cursor.left / cursor.right — navigation
//   entry.digit / entry.dot / entry.eex / entry.chs — number entry
//   op.add / op.sub / op.mul / op.div — binary arithmetic
//   softmenu.f1 … softmenu.f6 — soft-menu function keys
//   apps.open / mode.open / tool.open / var.open / stk.open / nxt.next /
//   hist.open / sym.open / eval.run / quote.tick — top-row system keys
//   mode.angle.next / mode.entry.toggle — mode-key shifted actions
//   fn.sin / fn.cos / fn.tan / fn.asin / fn.acos / fn.atan / fn.eex /
//   fn.sqrt / fn.square / fn.power / fn.inv / fn.ln / fn.exp / fn.log /
//   fn.tenx / fn.neg — common math operations
//   power.on / power.off — ON / shift-OFF

/**
 * Canonical field names of a key descriptor. Useful for tests / docs.
 * @type {readonly string[]}
 */
export const KEY_DESCRIPTOR_FIELDS = Object.freeze([
  'id',
  'primary',
  'leftShift',
  'rightShift',
  'alpha',
  'gridSpan',
  'command',
  'leftCommand',
  'rightCommand',
  'alphaChar',
  'keyboardKeys',
]);

/**
 * Build a key descriptor, applying defaults for omitted fields.
 *
 * @param {object} spec
 * @returns {object} fully-populated key descriptor
 */
function key(spec) {
  return {
    id: spec.id,
    primary: spec.primary ?? '',
    leftShift: spec.leftShift ?? '',
    rightShift: spec.rightShift ?? '',
    alpha: spec.alpha ?? '',
    gridSpan: spec.gridSpan ?? 1,
    command: spec.command ?? null,
    leftCommand: spec.leftCommand ?? null,
    rightCommand: spec.rightCommand ?? null,
    alphaChar: spec.alphaChar ?? '',
    keyboardKeys: Object.freeze(spec.keyboardKeys ? [...spec.keyboardKeys] : []),
  };
}

// ---------------------------------------------------------------------------
// Row 1 — Function / soft-menu row (F1 … F6)
// ---------------------------------------------------------------------------
const FUNCTION_ROW = [
  key({
    id: 'f1',
    primary: 'F1',
    leftShift: 'Y=',
    rightShift: 'WIN',
    alpha: 'A',
    command: 'softmenu.f1',
    leftCommand: 'plot.y_eq',
    rightCommand: 'plot.win',
    alphaChar: 'A',
    keyboardKeys: ['F1'],
  }),
  key({
    id: 'f2',
    primary: 'F2',
    leftShift: 'GRAPH',
    rightShift: '2D/3D',
    alpha: 'B',
    command: 'softmenu.f2',
    leftCommand: 'plot.graph',
    rightCommand: 'plot.dims',
    alphaChar: 'B',
    keyboardKeys: ['F2'],
  }),
  key({
    id: 'f3',
    primary: 'F3',
    leftShift: 'TBLSET',
    rightShift: 'TABLE',
    alpha: 'C',
    command: 'softmenu.f3',
    leftCommand: 'plot.tblset',
    rightCommand: 'plot.table',
    alphaChar: 'C',
    keyboardKeys: ['F3'],
  }),
  key({
    id: 'f4',
    primary: 'F4',
    leftShift: 'FCN',
    rightShift: 'PLOT',
    alpha: 'D',
    command: 'softmenu.f4',
    leftCommand: 'plot.fcn',
    rightCommand: 'plot.plot',
    alphaChar: 'D',
    keyboardKeys: ['F4'],
  }),
  key({
    id: 'f5',
    primary: 'F5',
    leftShift: 'PRG',
    rightShift: 'EQW',
    alpha: 'E',
    command: 'softmenu.f5',
    leftCommand: 'menu.prg',
    rightCommand: 'eqw.open',
    alphaChar: 'E',
    keyboardKeys: ['F5'],
  }),
  key({
    id: 'f6',
    primary: 'F6',
    leftShift: 'MTRW',
    rightShift: 'MTRX',
    alpha: 'F',
    command: 'softmenu.f6',
    leftCommand: 'matrix.writer',
    rightCommand: 'matrix.open',
    alphaChar: 'F',
    keyboardKeys: ['F6'],
  }),
];

// ---------------------------------------------------------------------------
// Row 2 — Top system / nav row (APPS, MODE, TOOL, VAR, STO►, NXT)
// ---------------------------------------------------------------------------
const SYSTEM_ROW_TOP = [
  key({
    id: 'apps',
    primary: 'APPS',
    leftShift: 'BEGIN',
    rightShift: 'FILES',
    alpha: 'G',
    command: 'apps.open',
    leftCommand: 'edit.begin',
    rightCommand: 'filer.open',
    alphaChar: 'G',
    keyboardKeys: [],
  }),
  key({
    id: 'mode',
    primary: 'MODE',
    leftShift: 'CUSTOM',
    rightShift: 'END',
    alpha: 'H',
    command: 'mode.open',
    leftCommand: 'mode.entry.toggle',
    rightCommand: 'edit.end',
    alphaChar: 'H',
    keyboardKeys: [],
  }),
  key({
    id: 'tool',
    primary: 'TOOL',
    leftShift: 'i',
    rightShift: 'I/O',
    alpha: 'I',
    command: 'tool.open',
    leftCommand: 'const.i',
    rightCommand: 'io.open',
    alphaChar: 'I',
    keyboardKeys: [],
  }),
  key({
    id: 'var',
    primary: 'VAR',
    leftShift: 'UPDIR',
    rightShift: 'COPY',
    alpha: 'J',
    command: 'var.open',
    leftCommand: 'dir.up',
    rightCommand: 'edit.copy',
    alphaChar: 'J',
    keyboardKeys: [],
  }),
  key({
    id: 'sto',
    primary: 'STO▶',
    leftShift: 'RCL',
    rightShift: 'CUT',
    alpha: 'K',
    command: 'stack.sto',
    leftCommand: 'stack.rcl',
    rightCommand: 'edit.cut',
    alphaChar: 'K',
    keyboardKeys: [],
  }),
  key({
    id: 'nxt',
    primary: 'NXT',
    leftShift: 'PREV',
    rightShift: 'PASTE',
    alpha: 'L',
    command: 'nxt.next',
    leftCommand: 'nxt.prev',
    rightCommand: 'edit.paste',
    alphaChar: 'L',
    keyboardKeys: [],
  }),
];

// ---------------------------------------------------------------------------
// Row 3 — Second system row (HIST, EVAL, ', SYMB, cursor-up cap, NXT-pair)
// On the HP 50G, the cursor pad straddles rows 3 and 4: the up arrow lives on
// the right of row 3 and the down arrow on the right of row 4, with LEFT and
// RIGHT bracketing the implicit ENTER target. We follow that convention.
// ---------------------------------------------------------------------------
const SYSTEM_ROW_MIDDLE = [
  key({
    id: 'hist',
    primary: 'HIST',
    leftShift: 'CMD',
    rightShift: 'UNDO',
    alpha: 'M',
    command: 'hist.open',
    leftCommand: 'hist.cmd',
    rightCommand: 'edit.undo',
    alphaChar: 'M',
    keyboardKeys: [],
  }),
  key({
    id: 'eval',
    primary: 'EVAL',
    leftShift: '→NUM',
    rightShift: '→Q',
    alpha: 'N',
    command: 'eval.run',
    leftCommand: 'eval.to_num',
    rightCommand: 'eval.to_q',
    alphaChar: 'N',
    keyboardKeys: [],
  }),
  key({
    id: 'tick',
    primary: "'",
    leftShift: '→',
    rightShift: '≤',
    alpha: 'O',
    command: 'quote.tick',
    leftCommand: 'logic.implies',
    rightCommand: 'cmp.le',
    alphaChar: 'O',
    keyboardKeys: ["'"],
  }),
  key({
    id: 'symb',
    primary: 'SYMB',
    leftShift: 'MTH',
    rightShift: 'CAT',
    alpha: 'P',
    command: 'sym.open',
    leftCommand: 'menu.mth',
    rightCommand: 'menu.cat',
    alphaChar: 'P',
    keyboardKeys: [],
  }),
  key({
    id: 'cursor-up',
    primary: '▲',
    leftShift: '',
    rightShift: 'STACK',
    alpha: '',
    command: 'cursor.up',
    leftCommand: null,
    rightCommand: 'stack.open',
    alphaChar: '',
    keyboardKeys: ['ArrowUp'],
  }),
];

// ---------------------------------------------------------------------------
// Row 4 — Cursor pad row (LEFT, ENTER, RIGHT) plus support keys
// ENTER is the large central key with a 2-cell span. LEFT/RIGHT cursor arrows
// surround it; DOWN appears on row 5.
// ---------------------------------------------------------------------------
const CURSOR_ROW = [
  key({
    id: 'cursor-left',
    primary: '◀',
    leftShift: '',
    rightShift: 'PICTURE',
    alpha: '',
    command: 'cursor.left',
    leftCommand: null,
    rightCommand: 'picture.open',
    alphaChar: '',
    keyboardKeys: ['ArrowLeft'],
  }),
  key({
    id: 'enter',
    primary: 'ENTER',
    leftShift: 'ANS',
    rightShift: '→LIST',
    alpha: '',
    gridSpan: 2,
    command: 'stack.enter',
    leftCommand: 'stack.ans',
    rightCommand: 'list.to_list',
    alphaChar: '',
    keyboardKeys: ['Enter'],
  }),
  key({
    id: 'cursor-right',
    primary: '▶',
    leftShift: '',
    rightShift: 'VIEW',
    alpha: '',
    command: 'cursor.right',
    leftCommand: null,
    rightCommand: 'view.open',
    alphaChar: '',
    keyboardKeys: ['ArrowRight'],
  }),
  key({
    id: 'cursor-down',
    primary: '▼',
    leftShift: '',
    rightShift: 'MENU',
    alpha: '',
    command: 'cursor.down',
    leftCommand: null,
    rightCommand: 'menu.toggle',
    alphaChar: '',
    keyboardKeys: ['ArrowDown'],
  }),
];

// ---------------------------------------------------------------------------
// Row 5 — Modifier row (LSHIFT, RSHIFT, ALPHA, +/-, EEX, DEL/DROP)
// ---------------------------------------------------------------------------
const MODIFIER_ROW = [
  key({
    id: 'lshift',
    primary: 'LSHIFT',
    leftShift: '',
    rightShift: '',
    alpha: '',
    command: 'shift.left',
    leftCommand: null,
    rightCommand: null,
    alphaChar: '',
    keyboardKeys: ['Shift'],
  }),
  key({
    id: 'rshift',
    primary: 'RSHIFT',
    leftShift: '',
    rightShift: '',
    alpha: '',
    command: 'shift.right',
    leftCommand: null,
    rightCommand: null,
    alphaChar: '',
    keyboardKeys: ['Control'],
  }),
  key({
    id: 'alpha',
    primary: 'ALPHA',
    leftShift: 'USER',
    rightShift: 'ENTRY',
    alpha: '',
    command: 'shift.alpha',
    leftCommand: 'user.toggle',
    rightCommand: 'mode.entry.toggle',
    alphaChar: '',
    keyboardKeys: ['Alt'],
  }),
  key({
    id: 'chs',
    primary: '+/-',
    leftShift: '√',
    rightShift: 'x²',
    alpha: 'Q',
    command: 'entry.chs',
    leftCommand: 'fn.sqrt',
    rightCommand: 'fn.square',
    alphaChar: 'Q',
    keyboardKeys: [],
  }),
  key({
    id: 'eex',
    primary: 'EEX',
    leftShift: '10ˣ',
    rightShift: 'LOG',
    alpha: 'R',
    command: 'entry.eex',
    leftCommand: 'fn.tenx',
    rightCommand: 'fn.log',
    alphaChar: 'R',
    keyboardKeys: [],
  }),
  key({
    id: 'del',
    primary: 'DEL',
    leftShift: 'CLEAR',
    rightShift: 'PURGE',
    alpha: 'S',
    command: 'stack.drop',
    leftCommand: 'stack.clear',
    rightCommand: 'var.purge',
    alphaChar: 'S',
    keyboardKeys: ['Backspace'],
  }),
];

// ---------------------------------------------------------------------------
// Row 6 — Trig / power / inv row (SIN, COS, TAN, √, y^x, 1/x)
// ---------------------------------------------------------------------------
const SCIENCE_ROW = [
  key({
    id: 'sin',
    primary: 'SIN',
    leftShift: 'ASIN',
    rightShift: '∂',
    alpha: 'T',
    command: 'fn.sin',
    leftCommand: 'fn.asin',
    rightCommand: 'calc.deriv',
    alphaChar: 'T',
    keyboardKeys: [],
  }),
  key({
    id: 'cos',
    primary: 'COS',
    leftShift: 'ACOS',
    rightShift: '∫',
    alpha: 'U',
    command: 'fn.cos',
    leftCommand: 'fn.acos',
    rightCommand: 'calc.integ',
    alphaChar: 'U',
    keyboardKeys: [],
  }),
  key({
    id: 'tan',
    primary: 'TAN',
    leftShift: 'ATAN',
    rightShift: 'Σ',
    alpha: 'V',
    command: 'fn.tan',
    leftCommand: 'fn.atan',
    rightCommand: 'calc.sum',
    alphaChar: 'V',
    keyboardKeys: [],
  }),
  key({
    id: 'sqrt',
    primary: '√x',
    leftShift: 'x²',
    rightShift: 'EXP',
    alpha: 'W',
    command: 'fn.sqrt',
    leftCommand: 'fn.square',
    rightCommand: 'fn.exp',
    alphaChar: 'W',
    keyboardKeys: [],
  }),
  key({
    id: 'power',
    primary: 'yˣ',
    leftShift: '√y',
    rightShift: 'LN',
    alpha: 'X',
    command: 'fn.power',
    leftCommand: 'fn.xroot',
    rightCommand: 'fn.ln',
    alphaChar: 'X',
    keyboardKeys: ['^'],
  }),
  key({
    id: 'inv',
    primary: '1/x',
    leftShift: 'eˣ',
    rightShift: 'MATH',
    alpha: 'Y',
    command: 'fn.inv',
    leftCommand: 'fn.exp',
    rightCommand: 'menu.math',
    alphaChar: 'Y',
    keyboardKeys: [],
  }),
];

// ---------------------------------------------------------------------------
// Rows 7–10 — Alphanumeric block (digits and operator column)
//
// Layout per row: [ letter-key, digit, digit, digit, operator ]
// SWAP is bound to the LSHIFT of the divide key (the HP 50G's stack-swap
// location), and matches the spec requirement that SWAP be reachable.
// ---------------------------------------------------------------------------
const ALPHA_ROW_7 = [
  key({
    id: 'alpha-z',
    primary: 'Z',
    leftShift: 'EQ',
    rightShift: 'NEW',
    alpha: 'Z',
    command: 'entry.alpha',
    leftCommand: 'var.eq',
    rightCommand: 'var.new',
    alphaChar: 'Z',
    keyboardKeys: [],
  }),
  key({
    id: 'digit-7',
    primary: '7',
    leftShift: 'SOLVE',
    rightShift: 'S.SLV',
    alpha: '',
    command: 'entry.digit',
    leftCommand: 'solver.open',
    rightCommand: 'solver.sym',
    alphaChar: '7',
    keyboardKeys: ['7'],
  }),
  key({
    id: 'digit-8',
    primary: '8',
    leftShift: 'PLOT',
    rightShift: 'PLOTFN',
    alpha: '',
    command: 'entry.digit',
    leftCommand: 'plot.menu',
    rightCommand: 'plot.fn',
    alphaChar: '8',
    keyboardKeys: ['8'],
  }),
  key({
    id: 'digit-9',
    primary: '9',
    leftShift: 'SYMB',
    rightShift: 'SYM/NUM',
    alpha: '',
    command: 'entry.digit',
    leftCommand: 'sym.menu',
    rightCommand: 'sym.num',
    alphaChar: '9',
    keyboardKeys: ['9'],
  }),
  key({
    id: 'op-div',
    primary: '÷',
    leftShift: 'SWAP',
    rightShift: 'ABS',
    alpha: '',
    command: 'op.div',
    leftCommand: 'stack.swap',
    rightCommand: 'fn.abs',
    alphaChar: '',
    keyboardKeys: ['/'],
  }),
];

const ALPHA_ROW_8 = [
  key({
    id: 'alpha-greek',
    primary: 'α',
    leftShift: 'CHARS',
    rightShift: 'UNITS',
    alpha: 'α',
    command: 'entry.alpha',
    leftCommand: 'menu.chars',
    rightCommand: 'menu.units',
    alphaChar: 'α',
    keyboardKeys: [],
  }),
  key({
    id: 'digit-4',
    primary: '4',
    leftShift: 'CALC',
    rightShift: 'CONVERT',
    alpha: '',
    command: 'entry.digit',
    leftCommand: 'calc.menu',
    rightCommand: 'convert.menu',
    alphaChar: '4',
    keyboardKeys: ['4'],
  }),
  key({
    id: 'digit-5',
    primary: '5',
    leftShift: 'ALG',
    rightShift: 'ARITH',
    alpha: '',
    command: 'entry.digit',
    leftCommand: 'menu.alg',
    rightCommand: 'menu.arith',
    alphaChar: '5',
    keyboardKeys: ['5'],
  }),
  key({
    id: 'digit-6',
    primary: '6',
    leftShift: 'STAT',
    rightShift: 'TIME',
    alpha: '',
    command: 'entry.digit',
    leftCommand: 'menu.stat',
    rightCommand: 'menu.time',
    alphaChar: '6',
    keyboardKeys: ['6'],
  }),
  key({
    id: 'op-mul',
    primary: '×',
    leftShift: 'π',
    rightShift: 'ARG',
    alpha: '',
    command: 'op.mul',
    leftCommand: 'const.pi',
    rightCommand: 'fn.arg',
    alphaChar: '',
    keyboardKeys: ['*'],
  }),
];

const ALPHA_ROW_9 = [
  key({
    id: 'alpha-paren',
    primary: '( )',
    leftShift: '[ ]',
    rightShift: '{ }',
    alpha: '',
    command: 'entry.parens',
    leftCommand: 'entry.brackets',
    rightCommand: 'entry.braces',
    alphaChar: '(',
    keyboardKeys: ['(', ')'],
  }),
  key({
    id: 'digit-1',
    primary: '1',
    leftShift: 'I/O',
    rightShift: 'LIB',
    alpha: '',
    command: 'entry.digit',
    leftCommand: 'io.menu',
    rightCommand: 'lib.menu',
    alphaChar: '1',
    keyboardKeys: ['1'],
  }),
  key({
    id: 'digit-2',
    primary: '2',
    leftShift: 'BASE',
    rightShift: 'EQ LIB',
    alpha: '',
    command: 'entry.digit',
    leftCommand: 'menu.base',
    rightCommand: 'eqlib.open',
    alphaChar: '2',
    keyboardKeys: ['2'],
  }),
  key({
    id: 'digit-3',
    primary: '3',
    leftShift: 'CMPLX',
    rightShift: 'POLY',
    alpha: '',
    command: 'entry.digit',
    leftCommand: 'menu.cmplx',
    rightCommand: 'menu.poly',
    alphaChar: '3',
    keyboardKeys: ['3'],
  }),
  key({
    id: 'op-sub',
    primary: '−',
    leftShift: '−>',
    rightShift: '−−',
    alpha: '',
    command: 'op.sub',
    leftCommand: 'entry.arrow',
    rightCommand: 'entry.dashes',
    alphaChar: '',
    keyboardKeys: ['-'],
  }),
];

const ALPHA_ROW_10 = [
  key({
    id: 'on',
    primary: 'ON',
    leftShift: 'CONT',
    rightShift: 'OFF',
    alpha: 'CANCEL',
    command: 'power.on',
    leftCommand: 'power.cont',
    rightCommand: 'power.off',
    alphaChar: '',
    keyboardKeys: ['Escape'],
  }),
  key({
    id: 'digit-0',
    primary: '0',
    leftShift: '∞',
    rightShift: '→',
    alpha: ' ',
    command: 'entry.digit',
    leftCommand: 'const.inf',
    rightCommand: 'entry.arrow',
    alphaChar: '0',
    keyboardKeys: ['0'],
  }),
  key({
    id: 'dot',
    primary: '.',
    leftShift: ',',
    rightShift: '→',
    alpha: '',
    command: 'entry.dot',
    leftCommand: 'entry.comma',
    rightCommand: 'mode.angle.next',
    alphaChar: '.',
    keyboardKeys: ['.', ','],
  }),
  key({
    id: 'spc',
    primary: 'SPC',
    leftShift: 'π',
    rightShift: '_',
    alpha: ' ',
    command: 'entry.space',
    leftCommand: 'const.pi',
    rightCommand: 'entry.underscore',
    alphaChar: ' ',
    keyboardKeys: [' ', 'Spacebar'],
  }),
  key({
    id: 'op-add',
    primary: '+',
    leftShift: 'CONJ',
    rightShift: '≡',
    alpha: '',
    command: 'op.add',
    leftCommand: 'fn.conj',
    rightCommand: 'cmp.eq',
    alphaChar: '',
    keyboardKeys: ['+'],
  }),
];

// ---------------------------------------------------------------------------
// Exported keypad — ordered list of rows.
// ---------------------------------------------------------------------------

/**
 * Ordered list of keypad rows, top to bottom, in HP 50G geometry.
 * Each row is an array of fully-populated key descriptors.
 *
 * @type {readonly object[][]}
 */
export const KEYPAD_ROWS = Object.freeze([
  FUNCTION_ROW,
  SYSTEM_ROW_TOP,
  SYSTEM_ROW_MIDDLE,
  CURSOR_ROW,
  MODIFIER_ROW,
  SCIENCE_ROW,
  ALPHA_ROW_7,
  ALPHA_ROW_8,
  ALPHA_ROW_9,
  ALPHA_ROW_10,
].map((row) => Object.freeze(row)));
