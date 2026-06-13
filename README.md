# pdlc-test — Scientific Calculator

A web-based scientific calculator for engineering-style calculations, delivered
as a React + TypeScript single-page app and packaged as a Docker image.

This commit scaffolds the monorepo; subsequent tickets implement the calculator
UI, expression evaluator, memory slot, accessibility polish, and tests.

## Repository layout

```
.
├── frontend/        # Vite + React + TypeScript SPA (the calculator)
├── Dockerfile       # Multi-stage build: builds the SPA, serves it with Nginx
├── nginx.conf       # Nginx config with SPA fallback for the production stage
└── .dockerignore
```

## Prerequisites

- **Node.js 20+** and **npm** (for local development and tests)
- **Docker** (for building / running the container image)

## Local development (without Docker)

```bash
cd frontend
npm install
npm run dev
```

Vite serves the SPA at `http://localhost:5173`.

## Tests

```bash
cd frontend
npm test
```

## Production build (static assets only)

```bash
cd frontend
npm install
npm run build
```

The bundle is emitted to `frontend/dist/`.

## Docker

The `Dockerfile` is multi-stage. The default target is the production Nginx
image; a `dev` stage is also defined for running the Vite dev server inside a
container.

### Production image

Build the image from the repo root:

```bash
docker build -t pdlc-calculator .
```

Run it, mapping the container's port 80 to a host port:

```bash
docker run --rm -p 8080:80 pdlc-calculator
```

Open `http://localhost:8080` — the SPA boilerplate should load.

### Dev image (optional)

Build and run the `dev` stage to use the Vite dev server in a container:

```bash
docker build --target dev -t pdlc-calculator-dev .
docker run --rm -p 5173:5173 pdlc-calculator-dev
```

Open `http://localhost:5173`.

> On Docker Desktop the same commands work from a terminal; the running
> container also shows up under **Containers** in the Docker Desktop UI.

## Out of scope for this ticket

- The actual calculator UI, expression parser/evaluator, memory feature, and
  keyboard/copy-paste handling — covered by later tickets in the calculator
  epic.
