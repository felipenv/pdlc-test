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

## Docker

Docker support gives every contributor a consistent environment for development,
testing, and production. The `Dockerfile` is multi-stage; `docker-compose.yml`
wraps the common workflows.

### Production image (default)

Build and run the production bundle (static files served by nginx on port 8080
with a `/health` endpoint):

```bash
docker compose up --build
# then open http://localhost:8080
```

Or with plain Docker:

```bash
docker build --target prod -t pdlc-test-frontend:prod .
docker run --rm -p 8080:8080 pdlc-test-frontend:prod
curl http://localhost:8080/health   # -> ok
```

### Development with hot reload

The `dev` profile runs the Vite dev server inside the container with the
working tree mounted, so edits trigger HMR:

```bash
docker compose --profile dev up --build
# then open http://localhost:5173
```

### Running tests in Docker

The `test` stage executes the Vitest suite at build time and fails the build if
any test fails:

```bash
docker build --target test -t pdlc-test-frontend:test .
```

### Producing the static bundle in Docker

The `build` stage produces `/app/dist` inside the image. To extract it to the
host, build the stage and copy from a temporary container:

```bash
docker build --target build -t pdlc-test-frontend:build .
id=$(docker create pdlc-test-frontend:build) && docker cp "$id":/app/dist ./dist && docker rm "$id"
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
