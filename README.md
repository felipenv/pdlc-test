# pdlc-test

This repository hosts two independent projects:

1. **`scientific_calculator/`** — a pure-Python scientific calculator package (see below).
2. **Tetris** — a browser-based Tetris game built with Vite and TypeScript (see the *Tetris* section further down).

---

## scientific_calculator

A self-contained scientific calculator implemented in **pure Python 3** using only the
standard library — no runtime dependencies. The package exposes a single public
`evaluate` API and a `scicalc` command-line entry point.

### Requirements

- **Python ≥ 3.10**
- No external packages — the standard library is enough.

### Example usage

```python
from scientific_calculator import evaluate

# Once the evaluator story lands, this will return 4.0.
# Today it raises NotImplementedError (forward-declared stub).
result = evaluate("2 + 2")
```

### CLI

After installation (`pip install -e .`), the package registers a console script:

```bash
scicalc "sqrt(2) * sin(pi / 4)"
```

The CLI module itself is delivered by a later story; the entry point is declared
up front so downstream stories can wire it without changing packaging metadata.

### Error hierarchy

All errors raised by the calculator inherit from `CalculatorError`:

| Exception              | Raised when                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| `CalculatorError`      | Base class — catch this to handle any calculator error.              |
| `SyntaxErrorCalc`      | The expression is syntactically invalid. Carries `position`, `token`. |
| `DomainErrorCalc`      | Math domain failure (`sqrt(-1)`, `log(0)`, division by zero, …).     |
| `UnknownSymbolError`   | The expression references an unknown identifier. Carries `name`.    |

---

## Tetris

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
