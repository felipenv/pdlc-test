# pdlc-test

Monorepo for a browser-based scientific calculator.

- [`frontend/`](./frontend) — calculator UI (Vite + TypeScript)
- [`backend/`](./backend) — expression-evaluation and memory API (Node + TypeScript)

The two packages are wired together with npm workspaces. Later tickets land the
calculator UI, the safe expression-evaluation API, and the Docker setup that
runs both services together.

## Prerequisites

- **Node.js** 18 or newer (20+ recommended) — required by Vite 5.
- **npm** 8 or newer — bundled with recent Node releases; provides workspaces.

## Install

From the repo root:

```bash
npm install
```

This installs dependencies for both workspaces in one pass.

## Development

Run the frontend dev server (Vite, hot module reload):

```bash
npm run dev:frontend
```

Run the backend (placeholder until the API ticket lands):

```bash
npm run dev:backend
```

## Build

Build every workspace that defines a `build` script:

```bash
npm run build
```

## Tests

Run every workspace's tests:

```bash
npm test
```

Or target a single workspace:

```bash
npm run test:frontend
npm run test:backend
```

## CI

GitHub Actions runs `npm install` and `npm test` on every push and pull
request — see [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).
