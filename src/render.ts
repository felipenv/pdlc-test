// Canvas rendering for the Tetris game.
//
// `createRenderer` captures references to the DOM surfaces (the primary
// playfield canvas, the optional next-piece preview canvas, and the
// optional HUD elements) and returns a `draw(state)` function that the
// game loop calls each frame. Rendering is purely a projection of
// `GameState` to pixels — no state is stored beyond the cached element /
// context references and pre-computed cell sizes.
//
// Visibility rules:
//   - The playfield grid is 10×22 with two hidden buffer rows at the top
//     (`HIDDEN_ROWS = 2`). Only the lower 20 rows are drawn.
//   - When `state.active` overlaps the hidden buffer, only the cells with
//     `y >= HIDDEN_ROWS` are painted.
//   - Status overlays:
//       'gameover' → if `gameoverEl` was supplied, its text is set and it
//                    is shown; otherwise a canvas overlay is drawn.
//       'paused'   → a translucent overlay with a "PAUSED" label is drawn
//                    on the playfield.
//       'playing'  → any previously-shown `gameoverEl` is cleared.
//
// The module does not import the DOM globals at the top level — all
// drawing happens inside `draw()` so the test suite can hand in mock
// canvas / context objects.

import type { GameState, Piece, PieceKind } from './types';
import {
  BOARD_HEIGHT_TOTAL,
  BOARD_HEIGHT_VISIBLE,
  BOARD_WIDTH,
  COLORS,
  HIDDEN_ROWS,
  TETROMINOES,
} from './constants';
import { getPieceCells } from './logic/collision';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Options accepted by {@link createRenderer}. */
export interface RendererOptions {
  /** Primary playfield canvas (10 × 20 visible cells). */
  playfield: HTMLCanvasElement;
  /** Optional next-piece preview canvas. */
  next?: HTMLCanvasElement;
  /** Optional HUD element receiving the current score (textContent). */
  scoreEl?: HTMLElement;
  /** Optional HUD element receiving the total lines cleared (textContent). */
  linesEl?: HTMLElement;
  /** Optional HUD element receiving the current level (textContent). */
  levelEl?: HTMLElement;
  /**
   * Optional element that displays the game-over banner. When provided,
   * the renderer flips its visibility instead of painting a canvas
   * overlay.
   */
  gameoverEl?: HTMLElement;
}

/** Return type of {@link createRenderer}. */
export interface Renderer {
  /** Project the given `state` onto the captured canvases / HUD. */
  draw(state: GameState): void;
}

/**
 * Build a per-frame renderer bound to the supplied DOM surfaces.
 *
 * The cell sizes are derived from the canvas dimensions and the
 * board geometry (`BOARD_WIDTH` / `BOARD_HEIGHT_VISIBLE`). For the
 * default 240×480 playfield this gives 24px cells. The next-piece
 * canvas uses a 4×4 grid (the largest tetromino bounding box, the I
 * piece) so a 96×96 canvas yields 24px preview cells.
 */
export function createRenderer(opts: RendererOptions): Renderer {
  const playfieldCtx = opts.playfield.getContext('2d');
  if (!playfieldCtx) {
    throw new Error('createRenderer: playfield canvas has no 2D context');
  }

  const nextCtx: CanvasRenderingContext2D | null = opts.next
    ? opts.next.getContext('2d')
    : null;
  if (opts.next && !nextCtx) {
    throw new Error('createRenderer: next canvas has no 2D context');
  }

  // Cell size in playfield pixels. We compute both dimensions and take
  // the integer floor so non-square canvases still produce sensible
  // cells even if the aspect ratio is slightly off.
  const cellW = opts.playfield.width / BOARD_WIDTH;
  const cellH = opts.playfield.height / BOARD_HEIGHT_VISIBLE;
  const cellSize = Math.floor(Math.min(cellW, cellH));

  // The I piece has a 4×4 bounding box; everything else fits inside it,
  // so 4 is the safest cell count for the preview surface.
  const NEXT_GRID = 4;
  const nextCellSize = opts.next
    ? Math.floor(Math.min(opts.next.width, opts.next.height) / NEXT_GRID)
    : 0;

  return {
    draw(state: GameState): void {
      // --- playfield ----------------------------------------------------
      playfieldCtx.clearRect(0, 0, opts.playfield.width, opts.playfield.height);
      drawGrid(playfieldCtx, state.grid, cellSize);
      if (state.active) {
        drawPiece(playfieldCtx, state.active, cellSize);
      }

      // --- next preview -------------------------------------------------
      if (opts.next && nextCtx) {
        drawNextPreview(nextCtx, state.next, nextCellSize, opts.next.width, opts.next.height);
      }

      // --- HUD ----------------------------------------------------------
      drawHud(state, opts.scoreEl, opts.linesEl, opts.levelEl);

      // --- status overlays ----------------------------------------------
      if (state.status === 'gameover') {
        if (opts.gameoverEl) {
          opts.gameoverEl.textContent = 'Game Over';
          opts.gameoverEl.style.display = '';
        } else {
          drawGameOverOverlay(playfieldCtx, opts.playfield.width, opts.playfield.height);
        }
      } else {
        if (opts.gameoverEl) {
          opts.gameoverEl.textContent = '';
          opts.gameoverEl.style.display = 'none';
        }
        if (state.status === 'paused') {
          drawPausedOverlay(playfieldCtx, opts.playfield.width, opts.playfield.height);
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fill a single playfield cell at the given **visible** coordinates.
 *
 * `visibleY` is the row index after the buffer has been stripped:
 * 0 ≤ visibleY < BOARD_HEIGHT_VISIBLE.
 */
function fillPlayfieldCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  visibleY: number,
  cellSize: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x * cellSize, visibleY * cellSize, cellSize, cellSize);
  // A thin border between cells improves visual separation without
  // changing the overall colour palette.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x * cellSize, visibleY * cellSize, cellSize, cellSize);
}

/**
 * Draw the locked cells of the grid. Rows 0..HIDDEN_ROWS-1 are skipped;
 * everything below is mapped to a visible row by subtracting
 * `HIDDEN_ROWS`.
 */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: GameState['grid'],
  cellSize: number,
): void {
  for (let y = HIDDEN_ROWS; y < BOARD_HEIGHT_TOTAL; y++) {
    const row = grid[y];
    if (!row) continue;
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const cell = row[x];
      if (cell === null) continue;
      fillPlayfieldCell(ctx, x, y - HIDDEN_ROWS, cellSize, COLORS[cell]);
    }
  }
}

/**
 * Draw the active piece on the playfield. Cells that sit inside the
 * hidden buffer (`y < HIDDEN_ROWS`) are skipped.
 */
function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  cellSize: number,
): void {
  const color = COLORS[piece.kind];
  for (const { x, y } of getPieceCells(piece)) {
    if (y < HIDDEN_ROWS) continue;
    if (y >= BOARD_HEIGHT_TOTAL) continue;
    if (x < 0 || x >= BOARD_WIDTH) continue;
    fillPlayfieldCell(ctx, x, y - HIDDEN_ROWS, cellSize, color);
  }
}

/**
 * Draw the upcoming piece into the preview surface, centred within the
 * canvas.
 */
function drawNextPreview(
  ctx: CanvasRenderingContext2D,
  kind: PieceKind,
  cellSize: number,
  canvasW: number,
  canvasH: number,
): void {
  ctx.clearRect(0, 0, canvasW, canvasH);
  const matrix = TETROMINOES[kind][0];
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;

  // Centre the piece's bounding box on the preview canvas. We do this
  // by computing the pixel size of the bounding box and offsetting by
  // (canvas - bbox) / 2.
  const bboxW = cols * cellSize;
  const bboxH = rows * cellSize;
  const offsetX = Math.floor((canvasW - bboxW) / 2);
  const offsetY = Math.floor((canvasH - bboxH) / 2);

  ctx.fillStyle = COLORS[kind];
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 1;
  for (let row = 0; row < rows; row++) {
    const matrixRow = matrix[row];
    for (let col = 0; col < matrixRow.length; col++) {
      if (matrixRow[col] !== 1) continue;
      const px = offsetX + col * cellSize;
      const py = offsetY + row * cellSize;
      ctx.fillRect(px, py, cellSize, cellSize);
      ctx.strokeRect(px, py, cellSize, cellSize);
    }
  }
}

/** Update the HUD text spans with the current score / lines / level. */
function drawHud(
  state: GameState,
  scoreEl: HTMLElement | undefined,
  linesEl: HTMLElement | undefined,
  levelEl: HTMLElement | undefined,
): void {
  if (scoreEl) scoreEl.textContent = String(state.score);
  if (linesEl) linesEl.textContent = String(state.lines);
  if (levelEl) levelEl.textContent = String(state.level);
}

/** Paint a translucent overlay with a "GAME OVER" label. */
function drawGameOverOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('GAME OVER', canvasW / 2, canvasH / 2);
}

/** Paint a translucent overlay with a "PAUSED" label. */
function drawPausedOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('PAUSED', canvasW / 2, canvasH / 2);
}
