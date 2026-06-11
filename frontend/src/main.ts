// Scientific calculator frontend entry point.
//
// Real UI wiring lands in a later ticket; this is the scaffold placeholder
// so Vite has a module to load and the workspace builds.
export function mount(root: HTMLElement): void {
  root.textContent = "Scientific Calculator";
}

const root = document.getElementById("app");
if (root) {
  mount(root);
}
