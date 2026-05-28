// Core type definitions for the Tetris game.
//
// These types describe the shape of the single immutable-ish `GameState`
// value and its constituent pieces. They are pure type declarations — no
// runtime code is emitted from this module.

/** The seven canonical tetromino kinds. */
export type PieceKind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

/**
 * The playfield grid: a 2D array of cells.
 *
 * Dimensions are 10 columns × 22 rows (2 hidden buffer rows at the top,
 * 20 visible rows below). A cell is either `null` (empty) or the
 * `PieceKind` of the locked piece occupying it.
 *
 * Convention: `grid[y][x]` where `y` grows downward (0 = top buffer row)
 * and `x` grows rightward (0 = leftmost column).
 */
export type Grid = (PieceKind | null)[][];

/** The currently active (falling) tetromino. */
export interface Piece {
  /** Which tetromino. */
  kind: PieceKind;
  /** Rotation state 0..3 (SRS conventions). */
  rotation: 0 | 1 | 2 | 3;
  /** X coordinate of the top-left of the bounding box on the grid. */
  x: number;
  /** Y coordinate of the top-left of the bounding box on the grid. */
  y: number;
}

/** Lifecycle status of the game. */
export type GameStatus = 'playing' | 'paused' | 'gameover';

/**
 * The complete game state. Treated as immutable-ish: pure reducer-style
 * functions return a new `GameState` rather than mutating the existing one.
 */
export interface GameState {
  /** The playfield grid (10×22, includes 2 hidden buffer rows). */
  grid: Grid;
  /** The currently falling piece, or `null` between spawns / on gameover. */
  active: Piece | null;
  /** The next piece kind to spawn (previewed in the UI). */
  next: PieceKind;
  /** The remaining piece kinds in the current 7-bag. */
  bag: PieceKind[];
  /** Current score. */
  score: number;
  /** Total lines cleared this game. */
  lines: number;
  /** Current level (drives gravity speed and bonus scoring). */
  level: number;
  /** Lifecycle status. */
  status: GameStatus;
  /**
   * Accumulated time (ms) since the last gravity step. The game loop adds
   * frame deltas to this; when it crosses the level's gravity threshold,
   * the piece drops one cell and the accumulator is decremented.
   */
  gravityAccumulatorMs: number;
}
