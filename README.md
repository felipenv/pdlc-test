# HP 50G Calculator

A static, dependency-free single-page web app that emulates the HP 50G
calculator. The MVP scaffold is plain HTML, CSS, and ES modules — no backend,
no build step, no external CDN resources. Everything needed to run the app is
self-contained inside this repository.

## Run it locally

No installation and no server are required for the scaffold.

1. Clone or download this repository.
2. Open `index.html` in a desktop browser (Chrome, Firefox, Safari, or Edge).

You can do this in any of the following ways:

- Double-click `index.html` in your file manager.
- Drag `index.html` onto an open browser window.
- From a terminal:
  - macOS: `open index.html`
  - Linux: `xdg-open index.html`
  - Windows: `start index.html`

The page should load without console errors and display the calculator
placeholder. Future stories will add the faceplate, keypad, display, and
evaluation engine.

## Repository layout

```
index.html          # Page shell — loads styles/main.css and src/main.js
src/
  main.js           # Entry script — mounts the calculator into #calculator-root
  engine/           # (reserved) state + expression evaluation
  ui/               # (reserved) display and keypad components
  input/            # (reserved) keyboard / pointer event dispatcher
  constants/        # (reserved) key definitions and function table
styles/
  main.css          # Top-level stylesheet (faceplate, keypad, display, LCD font)
assets/             # (reserved) self-contained fonts and icons
```

## Non-goals for the scaffold

- No backend service.
- No build tooling required to open the app.
- No external network requests (CDNs, web fonts, analytics, etc.).
