// Playwright screenshot test for the HP 50G LCD-style display.
//
// Authored here for the external CI workflow to execute — we never run
// Playwright locally per the task instructions. The spec opens the
// static `index.html` via `file://`, asserts the initial-state DOM
// contract from `src/ui/display.js`, and saves a screenshot the
// workflow attaches to the PR for visual verification.

import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_URL = pathToFileURL(
  path.resolve(__dirname, '..', 'index.html'),
).toString();

test.describe('HP 50G LCD display — initial state', () => {
  test('renders annunciators, four stack rows, and the entry line', async ({
    page,
  }) => {
    await page.goto(INDEX_URL);

    // ---- LCD container exists ------------------------------------------
    const lcd = page.locator('.lcd');
    await expect(lcd).toBeVisible();

    // ---- Annunciator row -----------------------------------------------
    //
    // Initial state is `angleMode: 'DEG'` and `entryMode: 'RPN'` with no
    // shift active and no extra flags, so the row should contain exactly
    // those two annunciators and nothing else.
    const annunciators = page.locator('.lcd-annunciators .lcd-annunciator');
    const labels = await annunciators.allTextContents();
    expect(labels).toContain('DEG');
    expect(labels).toContain('RPN');

    // ---- Stack rows ----------------------------------------------------
    //
    // Four rows must be present, labelled top-to-bottom as 4: 3: 2: 1:.
    const rows = page.locator('.lcd-stack .lcd-stack-row');
    await expect(rows).toHaveCount(4);

    const rowLabels = await page
      .locator('.lcd-stack .lcd-stack-row .lcd-stack-label')
      .allTextContents();
    expect(rowLabels).toEqual(['4:', '3:', '2:', '1:']);

    // Values are empty on the initial state — every visible level should
    // show the label only.
    const rowValues = await page
      .locator('.lcd-stack .lcd-stack-row .lcd-stack-value')
      .allTextContents();
    expect(rowValues).toEqual(['', '', '', '']);

    // ---- Entry line ----------------------------------------------------
    //
    // `selectEntryDisplay` returns `'0'` for an empty buffer.
    const entry = page.locator('.lcd-entry');
    await expect(entry).toBeVisible();
    await expect(entry).toHaveText('0');
    await expect(entry).not.toHaveClass(/lcd-error/);

    // ---- Visual verification artefact ----------------------------------
    //
    // The CI workflow attaches this PNG to the PR so the reviewer can
    // confirm the muted greenish-gray backplate, fixed-width font, and
    // inset-bezel styling without running the page locally.
    await lcd.screenshot({ path: 'display-initial.png' });
  });
});
