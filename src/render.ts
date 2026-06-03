// Canvas rendering for the Tetris game.
//
// `createRenderer` captures references to the DOM surfaces (the primary
// playfield canvas, the optional next-piece preview canvas, and the
// optional HUD elements) and returns a `draw(state)` function that the
// game loop calls each frame. Rendering is purely a projection of
// `GameState` to pixels — no state is stored beyond the cached element /
// context references and pre-computed cell sizes.
//
// Visual style — monochrome LCD:
//   Every cell is rendered as a concentric **brick glyph** — an outer
//   rounded-rectangle outline and an inner filled rectangle, both
//   painted in the same colour. Locked cells and the active piece use
//   the near-black `LCD_PALETTE.ink` ("on" pixel); empty cells use the
//   dim `LCD_PALETTE.ghost` ("off" pixel) and are drawn across the
//   entire visible board on every frame so the LCD ghost grid is
//   always visible. The canvas is filled with `LCD_PALETTE.screen`
//   before the bricks are painted, giving the playfield (and the
//   next-piece preview) the classic handheld Tetris look. There are
//   no per-tetromino colors — the deprecated `COLORS` map is no longer
//   referenced from this module.
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
//     Canvas overlays (PAUSED / GAME OVER) use `LCD_PALETTE.overlayTint`
//     for the darkened LCD-green dim layer and `LCD_PALETTE.ink` for the
//     label fill, rendered in the pixel HUD font family
//     ("Press Start 2P", mirroring the `--hud-font` CSS variable). The
//     DOM HUD spans (score / lines / level) are styled via `styles.css`;
//     no canvas text is drawn for the HUD by this module.
//
// The module does not import the DOM globals at the top level — all
// drawing happens inside `draw()` so the test suite can hand in mock
// canvas / context objects.

import type { GameState, Piece, PieceKind } from './types';
import {
  BOARD_HEIGHT_TOTAL,
  BOARD_HEIGHT_VISIBLE,
  BOARD_WIDTH,
  BRICK_CORNER_RADIUS,
  BRICK_INNER_PADDING,
  BRICK_OUTER_PADDING,
  HIDDEN_ROWS,
  LCD_PALETTE,
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

      // LCD screen background — every frame starts from a known fill so
      // any pre-existing pixels are wiped before the ghost grid + bricks
      // are layered on top.
      playfieldCtx.fillStyle = LCD_PALETTE.screen;
      playfieldCtx.fillRect(0, 0, opts.playfield.width, opts.playfield.height);

      // Persistent ghost grid — draw an "off" brick on every visible cell
      // so empty slots always show the LCD off-pixel silhouette.
      for (let visY = 0; visY < BOARD_HEIGHT_VISIBLE; visY++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
          drawBrickCell(playfieldCtx, x * cellSize, visY * cellSize, cellSize, 'off');
        }
      }

      // Locked cells (ink bricks) layered on top of the ghost grid.
      drawGrid(playfieldCtx, state.grid, cellSize);
      if (state.active) {
        drawPiece(playfieldCtx, state.active, cellSize);
      }

      // --- next preview -------------------------------------------------
      if (opts.next && nextCtx) {
        drawNextPreview(
          nextCtx,
          state.next,
          nextCellSize,
          opts.next.width,
          opts.next.height,
          NEXT_GRID,
        );
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
 * Paint a single LCD brick glyph at the given canvas-pixel position.
 *
 * The glyph is two concentric shapes — an outer rounded rectangle
 * outline and an inner filled rectangle — both painted in the same
 * colour pulled from {@link LCD_PALETTE}:
 *
 *   - `state === 'on'`  → `LCD_PALETTE.ink`  (locked cells / active piece)
 *   - `state === 'off'` → `LCD_PALETTE.ghost` (empty / ghost grid cell)
 *
 * Geometry is driven entirely by {@link BRICK_OUTER_PADDING},
 * {@link BRICK_INNER_PADDING}, and {@link BRICK_CORNER_RADIUS} so the
 * helper has no per-state branching beyond the colour selection.
 *
 * `pxX` / `pxY` are the canvas-pixel coordinates of the cell's
 * top-left corner; `cellSize` is the cell side length in pixels.
 */
function drawBrickCell(
  ctx: CanvasRenderingContext2D,
  pxX: number,
  pxY: number,
  cellSize: number,
  state: 'on' | 'off',
): void {
  const color = state === 'on' ? LCD_PALETTE.ink : LCD_PALETTE.ghost;

  // Outer rounded-rectangle outline.
  const outerX = pxX + BRICK_OUTER_PADDING;
  const outerY = pxY + BRICK_OUTER_PADDING;
  const outerSize = cellSize - 2 * BRICK_OUTER_PADDING;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(outerX, outerY, outerSize, outerSize, BRICK_CORNER_RADIUS);
  ctx.stroke();

  // Inner filled rectangle, inset by BRICK_INNER_PADDING on each side.
  const innerX = outerX + BRICK_INNER_PADDING;
  const innerY = outerY + BRICK_INNER_PADDING;
  const innerSize = outerSize - 2 * BRICK_INNER_PADDING;

  ctx.fillStyle = color;
  ctx.fillRect(innerX, innerY, innerSize, innerSize);
}

/**
 * Draw the locked cells of the grid in "on" ink. Rows
 * 0..HIDDEN_ROWS-1 are skipped; everything below is mapped to a visible
 * row by subtracting `HIDDEN_ROWS`.
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
      drawBrickCell(ctx, x * cellSize, (y - HIDDEN_ROWS) * cellSize, cellSize, 'on');
    }
  }
}

/**
 * Draw the active piece on the playfield in "on" ink. Cells that sit
 * inside the hidden buffer (`y < HIDDEN_ROWS`) are skipped. There is no
 * per-kind colour branching — the monochrome LCD style paints every
 * piece the same.
 */
function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  cellSize: number,
): void {
  for (const { x, y } of getPieceCells(piece)) {
    if (y < HIDDEN_ROWS) continue;
    if (y >= BOARD_HEIGHT_TOTAL) continue;
    if (x < 0 || x >= BOARD_WIDTH) continue;
    drawBrickCell(ctx, x * cellSize, (y - HIDDEN_ROWS) * cellSize, cellSize, 'on');
  }
}

/**
 * Draw the upcoming piece into the preview surface, centred within the
 * canvas. The preview mirrors the main playfield's LCD look: the canvas
 * is filled with the LCD `screen` background, a ghost grid covers the
 * 4×4 preview area (the I-piece bounding box), and the next piece is
 * painted as ink bricks over the top.
 */
function drawNextPreview(
  ctx: CanvasRenderingContext2D,
  kind: PieceKind,
  cellSize: number,
  canvasW: number,
  canvasH: number,
  nextGrid: number,
): void {
  ctx.clearRect(0, 0, canvasW, canvasH);

  // LCD screen background.
  ctx.fillStyle = LCD_PALETTE.screen;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Ghost grid — 4×4 off bricks centred in the canvas.
  const gridSize = nextGrid * cellSize;
  const gridOffsetX = Math.floor((canvasW - gridSize) / 2);
  const gridOffsetY = Math.floor((canvasH - gridSize) / 2);
  for (let row = 0; row < nextGrid; row++) {
    for (let col = 0; col < nextGrid; col++) {
      drawBrickCell(
        ctx,
        gridOffsetX + col * cellSize,
        gridOffsetY + row * cellSize,
        cellSize,
        'off',
      );
    }
  }

  // Active next piece — centred within its own bounding box so smaller
  // pieces (O, T, S, Z, J, L) sit visually centred against the ghost
  // grid.
  const matrix = TETROMINOES[kind][0];
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const bboxW = cols * cellSize;
  const bboxH = rows * cellSize;
  const pieceOffsetX = Math.floor((canvasW - bboxW) / 2);
  const pieceOffsetY = Math.floor((canvasH - bboxH) / 2);

  for (let row = 0; row < rows; row++) {
    const matrixRow = matrix[row];
    for (let col = 0; col < matrixRow.length; col++) {
      if (matrixRow[col] !== 1) continue;
      drawBrickCell(
        ctx,
        pieceOffsetX + col * cellSize,
        pieceOffsetY + row * cellSize,
        cellSize,
        'on',
      );
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

/**
 * Pixel/segmented font family used for on-canvas overlay labels.
 *
 * Mirrors the `--hud-font` CSS variable declared in `styles.css` so the
 * canvas text renders in the same "Press Start 2P" pixel typeface as the
 * DOM HUD spans. Canvas `ctx.font` cannot resolve CSS variables, so the
 * family list is inlined here verbatim.
 */
const OVERLAY_FONT_FAMILY = '"Press Start 2P", ui-monospace, "Courier New", monospace';

/**
 * Paint a translucent overlay with a "GAME OVER" label.
 *
 * The dim layer uses {@link LCD_PALETTE.overlayTint} (darkened LCD-green
 * semi-transparent fill) and the label is rendered in
 * {@link LCD_PALETTE.ink} using the pixel HUD font, so the overlay reads
 * as ink-on-LCD and matches the brick glyphs underneath.
 */
function drawGameOverOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
): void {
  ctx.fillStyle = LCD_PALETTE.overlayTint;
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.fillStyle = LCD_PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `20px ${OVERLAY_FONT_FAMILY}`;
  ctx.fillText('GAME OVER', canvasW / 2, canvasH / 2);
}

/**
 * Paint a translucent overlay with a "PAUSED" label.
 *
 * Uses the same LCD-toned dim and pixel-font ink styling as
 * {@link drawGameOverOverlay} so both status overlays read consistently
 * against the brick playfield.
 */
function drawPausedOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
): void {
  ctx.fillStyle = LCD_PALETTE.overlayTint;
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.fillStyle = LCD_PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `24px ${OVERLAY_FONT_FAMILY}`;
  ctx.fillText('PAUSED', canvasW / 2, canvasH / 2);
}
