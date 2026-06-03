// Vitest suite for `src/render.ts`.
//
// The vitest config uses `environment: "node"`, so no DOM is available.
// We hand-roll minimal mocks of `HTMLCanvasElement` and
// `CanvasRenderingContext2D` that record every drawing call we care
// about — including the path-API methods (`beginPath` / `roundRect` /
// `stroke`) used by the new monochrome brick glyph. The renderer is
// purely an imperative projection over those surfaces, so
// call-recording is enough to assert the contract.

import { describe, expect, it } from 'vitest';

import { createRenderer } from './render';
import type { GameState, Grid, Piece, PieceKind } from './types';
import {
  BOARD_HEIGHT_TOTAL,
  BOARD_HEIGHT_VISIBLE,
  BOARD_WIDTH,
  BRICK_CORNER_RADIUS,
  BRICK_INNER_PADDING,
  BRICK_OUTER_PADDING,
  COLORS,
  HIDDEN_ROWS,
  LCD_PALETTE,
  PIECE_KINDS,
  TETROMINOES,
} from './constants';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

interface DrawCall {
  type:
    | 'fillRect'
    | 'strokeRect'
    | 'clearRect'
    | 'fillText'
    | 'beginPath'
    | 'closePath'
    | 'roundRect'
    | 'stroke';
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
  text?: string;
  fillStyle?: string;
  strokeStyle?: string;
  font?: string;
  textAlign?: string;
  textBaseline?: string;
}

function makeMockContext(): {
  ctx: CanvasRenderingContext2D;
  calls: DrawCall[];
} {
  const calls: DrawCall[] = [];
  // Track the currently-set style so each draw call records the color
  // that was active when the call was issued.
  const state = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
  };

  // Track the most recent roundRect coordinates so a follow-up
  // `stroke()` call can report what it was actually outlining. The
  // renderer's brick helper issues exactly one roundRect per
  // beginPath → stroke triplet, so this is sufficient for assertions.
  let lastRoundRect:
    | { x: number; y: number; w: number; h: number; r: number }
    | null = null;

  const ctx = {
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(v: string) {
      state.fillStyle = v;
    },
    get strokeStyle() {
      return state.strokeStyle;
    },
    set strokeStyle(v: string) {
      state.strokeStyle = v;
    },
    get lineWidth() {
      return state.lineWidth;
    },
    set lineWidth(v: number) {
      state.lineWidth = v;
    },
    get font() {
      return state.font;
    },
    set font(v: string) {
      state.font = v;
    },
    get textAlign() {
      return state.textAlign;
    },
    set textAlign(v: string) {
      state.textAlign = v;
    },
    get textBaseline() {
      return state.textBaseline;
    },
    set textBaseline(v: string) {
      state.textBaseline = v;
    },
    fillRect(x: number, y: number, w: number, h: number): void {
      calls.push({
        type: 'fillRect',
        x,
        y,
        w,
        h,
        fillStyle: state.fillStyle,
      });
    },
    strokeRect(x: number, y: number, w: number, h: number): void {
      calls.push({
        type: 'strokeRect',
        x,
        y,
        w,
        h,
        strokeStyle: state.strokeStyle,
      });
    },
    clearRect(x: number, y: number, w: number, h: number): void {
      calls.push({ type: 'clearRect', x, y, w, h });
    },
    fillText(text: string, x: number, y: number): void {
      calls.push({
        type: 'fillText',
        x,
        y,
        text,
        fillStyle: state.fillStyle,
        font: state.font,
        textAlign: state.textAlign,
        textBaseline: state.textBaseline,
      });
    },
    beginPath(): void {
      calls.push({ type: 'beginPath', x: 0, y: 0 });
      lastRoundRect = null;
    },
    closePath(): void {
      calls.push({ type: 'closePath', x: 0, y: 0 });
    },
    roundRect(x: number, y: number, w: number, h: number, r: number): void {
      calls.push({ type: 'roundRect', x, y, w, h, r });
      lastRoundRect = { x, y, w, h, r };
    },
    stroke(): void {
      if (lastRoundRect) {
        calls.push({
          type: 'stroke',
          x: lastRoundRect.x,
          y: lastRoundRect.y,
          w: lastRoundRect.w,
          h: lastRoundRect.h,
          r: lastRoundRect.r,
          strokeStyle: state.strokeStyle,
        });
      } else {
        calls.push({ type: 'stroke', x: 0, y: 0, strokeStyle: state.strokeStyle });
      }
    },
  } as unknown as CanvasRenderingContext2D;

  return { ctx, calls };
}

function makeMockCanvas(width: number, height: number, ctx: CanvasRenderingContext2D): HTMLCanvasElement {
  return {
    width,
    height,
    getContext(kind: string): CanvasRenderingContext2D | null {
      return kind === '2d' ? ctx : null;
    },
  } as unknown as HTMLCanvasElement;
}

function makeMockEl(): HTMLElement {
  const node = {
    textContent: '',
    style: { display: '' } as CSSStyleDeclaration,
  };
  return node as unknown as HTMLElement;
}

// ---------------------------------------------------------------------------
// State factories
// ---------------------------------------------------------------------------

function emptyGrid(): Grid {
  return Array.from({ length: BOARD_HEIGHT_TOTAL }, () =>
    Array.from({ length: BOARD_WIDTH }, () => null as PieceKind | null),
  );
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    grid: emptyGrid(),
    active: null,
    next: 'T',
    bag: [],
    score: 0,
    lines: 0,
    level: 1,
    status: 'playing',
    gravityAccumulatorMs: 0,
    ...overrides,
  };
}

// Geometry helpers — re-derive what the renderer should be doing so the
// assertions read top-down without magic numbers.
const CELL_SIZE = 24; // 240/10 = 480/20 = 24
const OUTER_INSET = BRICK_OUTER_PADDING;
const OUTER_SIZE = CELL_SIZE - 2 * BRICK_OUTER_PADDING;
const INNER_INSET = BRICK_OUTER_PADDING + BRICK_INNER_PADDING;
const INNER_SIZE = OUTER_SIZE - 2 * BRICK_INNER_PADDING;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createRenderer', () => {
  it('throws when the playfield canvas has no 2D context', () => {
    const broken = {
      width: 240,
      height: 480,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    expect(() => createRenderer({ playfield: broken })).toThrow(/2D context/);
  });

  it('clears the playfield at the start of every draw call', () => {
    const { ctx, calls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);
    const renderer = createRenderer({ playfield });
    renderer.draw(makeState());

    // The very first call should be clearRect over the full canvas.
    expect(calls[0]).toMatchObject({ type: 'clearRect', x: 0, y: 0, w: 240, h: 480 });

    // A second draw also begins with clearRect.
    const clearsBefore = calls.filter((c) => c.type === 'clearRect').length;
    renderer.draw(makeState());
    const clearsAfter = calls.filter((c) => c.type === 'clearRect').length;
    expect(clearsAfter).toBe(clearsBefore + 1);
  });

  it('paints the LCD screen background over the playfield every frame', () => {
    const { ctx, calls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);
    createRenderer({ playfield }).draw(makeState());

    // The very first fillRect after clearRect should cover the canvas
    // in LCD_PALETTE.screen.
    const screenFill = calls.find(
      (c) =>
        c.type === 'fillRect' &&
        c.x === 0 &&
        c.y === 0 &&
        c.w === 240 &&
        c.h === 480 &&
        c.fillStyle === LCD_PALETTE.screen,
    );
    expect(screenFill).toBeDefined();

    // It must come before any cell paints (the ghost grid).
    const screenIdx = calls.findIndex(
      (c) =>
        c.type === 'fillRect' &&
        c.w === 240 &&
        c.h === 480 &&
        c.fillStyle === LCD_PALETTE.screen,
    );
    const firstCellPaintIdx = calls.findIndex(
      (c) => c.type === 'fillRect' && c.w === INNER_SIZE,
    );
    expect(screenIdx).toBeGreaterThanOrEqual(0);
    expect(firstCellPaintIdx).toBeGreaterThan(screenIdx);
  });

  it('draws a ghost brick on every visible playfield cell (10×20)', () => {
    const { ctx, calls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);
    createRenderer({ playfield }).draw(makeState());

    // Ghost inner fills: INNER_SIZE × INNER_SIZE rectangles in
    // LCD_PALETTE.ghost — one per visible cell.
    const ghostInner = calls.filter(
      (c) =>
        c.type === 'fillRect' &&
        c.w === INNER_SIZE &&
        c.h === INNER_SIZE &&
        c.fillStyle === LCD_PALETTE.ghost,
    );
    expect(ghostInner).toHaveLength(BOARD_WIDTH * BOARD_HEIGHT_VISIBLE);

    // Ghost outer strokes: OUTER_SIZE × OUTER_SIZE rounded rects
    // stroked in LCD_PALETTE.ghost — also one per visible cell.
    const ghostOuter = calls.filter(
      (c) =>
        c.type === 'stroke' &&
        c.w === OUTER_SIZE &&
        c.h === OUTER_SIZE &&
        c.r === BRICK_CORNER_RADIUS &&
        c.strokeStyle === LCD_PALETTE.ghost,
    );
    expect(ghostOuter).toHaveLength(BOARD_WIDTH * BOARD_HEIGHT_VISIBLE);
  });

  it('never paints cells in the hidden buffer rows (0..HIDDEN_ROWS-1)', () => {
    const { ctx, calls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);
    const grid = emptyGrid();

    // Plant blocks in every column of every hidden buffer row.
    for (let y = 0; y < HIDDEN_ROWS; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        grid[y][x] = 'I';
      }
    }
    // Plant a sentinel block in the first visible row so we know
    // rendering actually happened.
    grid[HIDDEN_ROWS][0] = 'O';

    createRenderer({ playfield }).draw(makeState({ grid }));

    // No INNER_SIZE fillRect should land at a negative y or at a y that
    // would correspond to a hidden buffer row. The smallest legal y for
    // an inner fill is `BRICK_OUTER_PADDING + BRICK_INNER_PADDING` (=
    // INNER_INSET) — i.e. visible row 0, column 0 of the ink layer.
    const inkInner = calls.filter(
      (c) =>
        c.type === 'fillRect' &&
        c.w === INNER_SIZE &&
        c.h === INNER_SIZE &&
        c.fillStyle === LCD_PALETTE.ink,
    );
    for (const call of inkInner) {
      expect(call.y).toBeGreaterThanOrEqual(INNER_INSET);
    }

    // The sentinel block should appear at (0, 0) of the visible grid in
    // LCD ink.
    const sentinel = inkInner.find((c) => c.x === INNER_INSET && c.y === INNER_INSET);
    expect(sentinel).toBeDefined();
  });

  it('paints every locked cell in LCD_PALETTE.ink regardless of kind', () => {
    const { ctx, calls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);
    const grid = emptyGrid();

    const kinds: PieceKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    kinds.forEach((kind, idx) => {
      // Place each kind in the bottom row, column idx.
      grid[BOARD_HEIGHT_TOTAL - 1][idx] = kind;
    });

    createRenderer({ playfield }).draw(makeState({ grid }));

    const bottomVisibleRowPx = (BOARD_HEIGHT_TOTAL - 1 - HIDDEN_ROWS) * CELL_SIZE;
    for (let idx = 0; idx < kinds.length; idx++) {
      const expectedInnerX = idx * CELL_SIZE + INNER_INSET;
      const expectedInnerY = bottomVisibleRowPx + INNER_INSET;
      const innerFill = calls.find(
        (c) =>
          c.type === 'fillRect' &&
          c.x === expectedInnerX &&
          c.y === expectedInnerY &&
          c.w === INNER_SIZE &&
          c.h === INNER_SIZE &&
          c.fillStyle === LCD_PALETTE.ink,
      );
      expect(innerFill, `expected ink inner for ${kinds[idx]}`).toBeDefined();

      const expectedOuterX = idx * CELL_SIZE + OUTER_INSET;
      const expectedOuterY = bottomVisibleRowPx + OUTER_INSET;
      const outerStroke = calls.find(
        (c) =>
          c.type === 'stroke' &&
          c.x === expectedOuterX &&
          c.y === expectedOuterY &&
          c.w === OUTER_SIZE &&
          c.h === OUTER_SIZE &&
          c.r === BRICK_CORNER_RADIUS &&
          c.strokeStyle === LCD_PALETTE.ink,
      );
      expect(outerStroke, `expected ink outer for ${kinds[idx]}`).toBeDefined();
    }
  });

  it('paints the active piece in LCD ink and skips buffer cells', () => {
    const { ctx, calls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);

    // T piece spawned at the top — part of its 3×3 bbox sits in the
    // hidden buffer (row 1) and part in the first visible row.
    const active: Piece = { kind: 'T', rotation: 0, x: 3, y: 1 };
    // TETROMINOES.T[0] is
    //   [0,1,0]
    //   [1,1,1]
    //   [0,0,0]
    // With y=1 the top row is at grid y=1 (buffer) and the middle row
    // at grid y=2 (visible row 0).
    createRenderer({ playfield }).draw(makeState({ active }));

    // Inner ink fills of the active piece — three at visible row 0,
    // columns 3..5.
    const inkInner = calls.filter(
      (c) =>
        c.type === 'fillRect' &&
        c.w === INNER_SIZE &&
        c.h === INNER_SIZE &&
        c.fillStyle === LCD_PALETTE.ink,
    );
    expect(inkInner).toHaveLength(3);
    const ys = inkInner.map((c) => c.y).sort();
    expect(new Set(ys)).toEqual(new Set([INNER_INSET]));
    const xs = inkInner.map((c) => c.x).sort((a, b) => a - b);
    expect(xs).toEqual([
      3 * CELL_SIZE + INNER_INSET,
      4 * CELL_SIZE + INNER_INSET,
      5 * CELL_SIZE + INNER_INSET,
    ]);
  });

  it('renders the next-piece preview with LCD background, ghost grid and ink piece', () => {
    const { ctx: playfieldCtx } = makeMockContext();
    const { ctx: nextCtx, calls: nextCalls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, playfieldCtx);
    const next = makeMockCanvas(96, 96, nextCtx);

    createRenderer({ playfield, next }).draw(makeState({ next: 'L' }));

    // The preview should begin with a clearRect over its surface.
    expect(nextCalls[0]).toMatchObject({ type: 'clearRect', x: 0, y: 0, w: 96, h: 96 });

    // A full-canvas screen fill follows.
    const screenFill = nextCalls.find(
      (c) =>
        c.type === 'fillRect' &&
        c.x === 0 &&
        c.y === 0 &&
        c.w === 96 &&
        c.h === 96 &&
        c.fillStyle === LCD_PALETTE.screen,
    );
    expect(screenFill).toBeDefined();

    // 4×4 ghost grid in the preview canvas.
    const ghostInner = nextCalls.filter(
      (c) =>
        c.type === 'fillRect' &&
        c.w === INNER_SIZE &&
        c.h === INNER_SIZE &&
        c.fillStyle === LCD_PALETTE.ghost,
    );
    expect(ghostInner).toHaveLength(4 * 4);

    // The L piece (R0) has four filled cells, all painted in ink.
    const matrix = TETROMINOES.L[0];
    const filledCount = matrix.flat().filter((v) => v === 1).length;
    const inkInner = nextCalls.filter(
      (c) =>
        c.type === 'fillRect' &&
        c.w === INNER_SIZE &&
        c.h === INNER_SIZE &&
        c.fillStyle === LCD_PALETTE.ink,
    );
    expect(inkInner).toHaveLength(filledCount);
  });

  it('drawBrickCell pairs an outline + inner fill in the same colour for both states', () => {
    const { ctx, calls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);
    const grid = emptyGrid();
    grid[BOARD_HEIGHT_TOTAL - 1][0] = 'I';

    createRenderer({ playfield }).draw(makeState({ grid }));

    // Every roundRect followed by a stroke must share its colour with
    // an immediately-following fillRect of the inner dimensions.
    // We walk the call list and check the brick groups in order.
    const brickGroups: Array<{
      stroke: DrawCall;
      fill: DrawCall;
    }> = [];
    for (let i = 0; i < calls.length; i++) {
      if (calls[i].type === 'stroke' && calls[i].w === OUTER_SIZE) {
        // Find the very next fillRect of INNER_SIZE.
        for (let j = i + 1; j < calls.length; j++) {
          if (calls[j].type === 'fillRect' && calls[j].w === INNER_SIZE) {
            brickGroups.push({ stroke: calls[i], fill: calls[j] });
            break;
          }
        }
      }
    }

    expect(brickGroups.length).toBeGreaterThan(0);
    for (const { stroke, fill } of brickGroups) {
      expect(stroke.strokeStyle).toBe(fill.fillStyle);
      expect([LCD_PALETTE.ink, LCD_PALETTE.ghost]).toContain(stroke.strokeStyle);
    }
  });

  it('never paints any per-kind COLORS literal in render output', () => {
    const { ctx, calls } = makeMockContext();
    const { ctx: nextCtx, calls: nextCalls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);
    const next = makeMockCanvas(96, 96, nextCtx);
    const grid = emptyGrid();
    const kinds: PieceKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    kinds.forEach((kind, idx) => {
      grid[BOARD_HEIGHT_TOTAL - 1][idx] = kind;
    });
    const active: Piece = { kind: 'I', rotation: 0, x: 3, y: 5 };

    createRenderer({ playfield, next }).draw(makeState({ grid, active, next: 'T' }));

    const forbidden = new Set(PIECE_KINDS.map((k) => COLORS[k]));
    const allFillStyles = [...calls, ...nextCalls]
      .map((c) => c.fillStyle)
      .filter((s): s is string => typeof s === 'string');
    const allStrokeStyles = [...calls, ...nextCalls]
      .map((c) => c.strokeStyle)
      .filter((s): s is string => typeof s === 'string');

    for (const style of [...allFillStyles, ...allStrokeStyles]) {
      expect(forbidden.has(style)).toBe(false);
    }
  });

  it('reflects score, lines, and level in HUD textContent on every draw', () => {
    const { ctx } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);
    const scoreEl = makeMockEl();
    const linesEl = makeMockEl();
    const levelEl = makeMockEl();

    const renderer = createRenderer({ playfield, scoreEl, linesEl, levelEl });

    renderer.draw(makeState({ score: 123, lines: 7, level: 3 }));
    expect(scoreEl.textContent).toBe('123');
    expect(linesEl.textContent).toBe('7');
    expect(levelEl.textContent).toBe('3');

    renderer.draw(makeState({ score: 999, lines: 12, level: 5 }));
    expect(scoreEl.textContent).toBe('999');
    expect(linesEl.textContent).toBe('12');
    expect(levelEl.textContent).toBe('5');
  });

  it('draws a "GAME OVER" overlay when no gameoverEl is provided', () => {
    const { ctx, calls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);

    createRenderer({ playfield }).draw(makeState({ status: 'gameover' }));

    // Overlay dim is the darkened LCD-green semi-transparent tint, not
    // a generic black wash — matches `LCD_PALETTE.overlayTint`.
    const overlayFill = calls.find(
      (c) =>
        c.type === 'fillRect' &&
        c.x === 0 &&
        c.y === 0 &&
        c.w === 240 &&
        c.h === 480 &&
        c.fillStyle === LCD_PALETTE.overlayTint,
    );
    expect(overlayFill).toBeDefined();

    const label = calls.find((c) => c.type === 'fillText' && c.text === 'GAME OVER');
    expect(label).toBeDefined();
    expect(label?.x).toBe(120);
    expect(label?.y).toBe(240);
    // Label is painted in LCD ink using the pixel HUD font family.
    expect(label?.fillStyle).toBe(LCD_PALETTE.ink);
    expect(label?.font).toContain('Press Start 2P');
  });

  it('sets gameoverEl text instead of overlay when supplied', () => {
    const { ctx, calls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);
    const gameoverEl = makeMockEl();

    createRenderer({ playfield, gameoverEl }).draw(makeState({ status: 'gameover' }));

    expect(gameoverEl.textContent).toBe('Game Over');
    expect(gameoverEl.style.display).toBe('');

    const label = calls.find((c) => c.type === 'fillText' && c.text === 'GAME OVER');
    expect(label).toBeUndefined();
  });

  it('clears gameoverEl when status returns to playing', () => {
    const { ctx } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);
    const gameoverEl = makeMockEl();

    const renderer = createRenderer({ playfield, gameoverEl });
    renderer.draw(makeState({ status: 'gameover' }));
    expect(gameoverEl.textContent).toBe('Game Over');

    renderer.draw(makeState({ status: 'playing' }));
    expect(gameoverEl.textContent).toBe('');
    expect(gameoverEl.style.display).toBe('none');
  });

  it('draws a "PAUSED" overlay when status is paused', () => {
    const { ctx, calls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);

    createRenderer({ playfield }).draw(makeState({ status: 'paused' }));

    // Overlay dim is the darkened LCD-green semi-transparent tint, not
    // a generic black wash — matches `LCD_PALETTE.overlayTint`.
    const overlayFill = calls.find(
      (c) =>
        c.type === 'fillRect' &&
        c.x === 0 &&
        c.y === 0 &&
        c.w === 240 &&
        c.h === 480 &&
        c.fillStyle === LCD_PALETTE.overlayTint,
    );
    expect(overlayFill).toBeDefined();

    const label = calls.find((c) => c.type === 'fillText' && c.text === 'PAUSED');
    expect(label).toBeDefined();
    expect(label?.x).toBe(120);
    expect(label?.y).toBe(240);
    // Label is painted in LCD ink using the pixel HUD font family.
    expect(label?.fillStyle).toBe(LCD_PALETTE.ink);
    expect(label?.font).toContain('Press Start 2P');
  });

  it('does not draw status overlays while playing', () => {
    const { ctx, calls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);

    createRenderer({ playfield }).draw(makeState({ status: 'playing' }));

    const labels = calls.filter(
      (c) => c.type === 'fillText' && (c.text === 'PAUSED' || c.text === 'GAME OVER'),
    );
    expect(labels).toHaveLength(0);
  });
});
