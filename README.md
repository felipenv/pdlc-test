# pdlc-test

A browser-based Tetris game built with [Vite](https://vitejs.dev/) and TypeScript. Play classic Tetris in your browser with keyboard controls, soft/hard drop, rotation, pause, and restart.

## Prerequisites

- **Node.js** 18 or newer (20+ recommended) — required by Vite 5.
- **npm** (bundled with Node.js).

## Install

Install dependencies from the repo root:

```bash
npm install
```

## Development

Start the Vite dev server (with hot module reload):

```bash
npm run dev
```

The dev server prints a local URL (typically `http://localhost:5173`) — open it in your browser to play.

## Production build

Create an optimized production build:

```bash
npm run build
```

Preview the built output locally:

```bash
npm run preview
```

## Tests

Run the [Vitest](https://vitest.dev/) test suite once:

```bash
npm test
```

## Controls

| Key            | Action                  |
| -------------- | ----------------------- |
| ← / →          | Move piece left / right |
| ↓              | Soft drop               |
| Space          | Hard drop               |
| ↑ or X         | Rotate clockwise        |
| Z              | Rotate counter-clockwise |
| P              | Pause / resume          |
| R              | Restart the game        |
