// Vitest suite for `src/render.ts`.
//
// The vitest config uses `environment: "node"`, so no DOM is available.
// We hand-roll minimal mocks of `HTMLCanvasElement` and
// `CanvasRenderingContext2D` that record every drawing call we care
// about. The renderer is purely an imperative projection over those
// surfaces, so call-recording is enough to assert the contract.

import { describe, expect, it } from 'vitest';

import { createRenderer } from './render';
import type { GameState, Grid, Piece, PieceKind } from './types';
import {
  BOARD_HEIGHT_TOTAL,
  BOARD_WIDTH,
  COLORS,
  HIDDEN_ROWS,
  TETROMINOES,
} from './constants';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

interface DrawCall {
  type: 'fillRect' | 'strokeRect' | 'clearRect' | 'fillText';
  x: number;
  y: number;
  w?: number;
  h?: number;
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

    // Cell size for a 240×480 canvas with a 10×20 visible grid = 24px.
    const cellSize = 24;

    // No fillRect should target the negative y region that would
    // correspond to the hidden rows. Since we map y -> y-HIDDEN_ROWS
    // and skip cells in the buffer entirely, the smallest legal y is 0
    // (i.e. visible row 0).
    const cellFills = calls.filter((c) => c.type === 'fillRect' && c.w === cellSize && c.h === cellSize);
    for (const call of cellFills) {
      expect(call.y).toBeGreaterThanOrEqual(0);
      // Buffer rows would have ended up at y=-2*cellSize or y=-1*cellSize.
      expect(call.y).not.toBe(-cellSize);
      expect(call.y).not.toBe(-2 * cellSize);
    }

    // The sentinel block should appear at the top of the visible grid
    // (y=0) in the O colour.
    const sentinel = cellFills.find((c) => c.x === 0 && c.y === 0);
    expect(sentinel?.fillStyle).toBe(COLORS.O);
  });

  it('paints locked cells using their COLORS palette', () => {
    const { ctx, calls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);
    const grid = emptyGrid();

    const kinds: PieceKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    kinds.forEach((kind, idx) => {
      // Place each kind in the bottom row, column idx.
      grid[BOARD_HEIGHT_TOTAL - 1][idx] = kind;
    });

    createRenderer({ playfield }).draw(makeState({ grid }));

    const cellSize = 24;
    const bottomVisibleY = (BOARD_HEIGHT_TOTAL - 1 - HIDDEN_ROWS) * cellSize;
    for (let idx = 0; idx < kinds.length; idx++) {
      const kind = kinds[idx];
      const fill = calls.find(
        (c) =>
          c.type === 'fillRect' &&
          c.x === idx * cellSize &&
          c.y === bottomVisibleY &&
          c.w === cellSize &&
          c.h === cellSize,
      );
      expect(fill, `expected fill for ${kind}`).toBeDefined();
      expect(fill?.fillStyle).toBe(COLORS[kind]);
    }
  });

  it('paints the active piece in its own colour and skips buffer cells', () => {
    const { ctx, calls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, ctx);

    // T piece spawned at the top — part of its 3×3 bbox sits in the
    // hidden buffer (row 0) and part in the first visible row (row 2 in
    // grid coords, row 0 in visible coords).
    const active: Piece = { kind: 'T', rotation: 0, x: 3, y: 1 };
    // TETROMINOES.T[0] is
    //   [0,1,0]
    //   [1,1,1]
    //   [0,0,0]
    // With y=1 the top row is at grid y=1 (buffer) and the middle row
    // at grid y=2 (visible row 0).
    createRenderer({ playfield }).draw(makeState({ active }));

    const cellSize = 24;
    const tFills = calls.filter(
      (c) => c.type === 'fillRect' && c.w === cellSize && c.h === cellSize && c.fillStyle === COLORS.T,
    );

    // Three cells of the middle row of the T should land at visible
    // row 0; the top cell at grid y=1 is inside the buffer and must
    // be skipped.
    expect(tFills).toHaveLength(3);
    const ys = tFills.map((c) => c.y).sort();
    expect(new Set(ys)).toEqual(new Set([0]));
    const xs = tFills.map((c) => c.x).sort((a, b) => a - b);
    expect(xs).toEqual([3 * cellSize, 4 * cellSize, 5 * cellSize]);
  });

  it('renders the next piece into the preview surface using its colour', () => {
    const { ctx: playfieldCtx } = makeMockContext();
    const { ctx: nextCtx, calls: nextCalls } = makeMockContext();
    const playfield = makeMockCanvas(240, 480, playfieldCtx);
    const next = makeMockCanvas(96, 96, nextCtx);

    createRenderer({ playfield, next }).draw(makeState({ next: 'L' }));

    // The preview should begin with a clearRect over its surface.
    expect(nextCalls[0]).toMatchObject({ type: 'clearRect', x: 0, y: 0, w: 96, h: 96 });

    // L piece R0 has four filled cells. Each should be filled with
    // the L colour at the preview cell size (96 / 4 = 24).
    const matrix = TETROMINOES.L[0];
    const filledCount = matrix.flat().filter((v) => v === 1).length;
    const fills = nextCalls.filter(
      (c) => c.type === 'fillRect' && c.fillStyle === COLORS.L && c.w === 24 && c.h === 24,
    );
    expect(fills).toHaveLength(filledCount);
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

    const overlayFill = calls.find(
      (c) =>
        c.type === 'fillRect' &&
        c.x === 0 &&
        c.y === 0 &&
        c.w === 240 &&
        c.h === 480 &&
        typeof c.fillStyle === 'string' &&
        c.fillStyle.startsWith('rgba(0, 0, 0'),
    );
    expect(overlayFill).toBeDefined();

    const label = calls.find((c) => c.type === 'fillText' && c.text === 'GAME OVER');
    expect(label).toBeDefined();
    expect(label?.x).toBe(120);
    expect(label?.y).toBe(240);
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

    const overlayFill = calls.find(
      (c) =>
        c.type === 'fillRect' &&
        c.x === 0 &&
        c.y === 0 &&
        c.w === 240 &&
        c.h === 480 &&
        typeof c.fillStyle === 'string' &&
        c.fillStyle.startsWith('rgba(0, 0, 0'),
    );
    expect(overlayFill).toBeDefined();

    const label = calls.find((c) => c.type === 'fillText' && c.text === 'PAUSED');
    expect(label).toBeDefined();
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
