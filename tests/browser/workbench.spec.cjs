const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs/promises');
const path = require('node:path');
const VQE = require('../../engine.js');

test.beforeEach(async ({ page }) => {
  await page.goto('/?example=1');
  await expect(page.locator('#runStatus')).toHaveText('Example · seed 42');
});

test('computed example, views and layouts work without external requests', async ({ page }, testInfo) => {
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:8000')) external.push(request.url()); });
  await page.reload();
  await expect(page.locator('#bestEnergy')).toHaveText('-1.85727');
  await expect(page.locator('#evaluationCount')).toContainText('1,301');
  for (const view of ['overview', 'landscape', 'circuit', 'parameters', 'experiments']) {
    await page.locator(`#tab-${view}`).click();
    await expect(page.locator(`#${view}`)).toBeVisible();
    await expect(page.locator(`#tab-${view}`)).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (view === 'circuit') await expect(page.locator('#circuitDiagram svg')).toBeVisible();
  }
  expect(errors).toEqual([]); expect(external).toEqual([]);
  await page.locator('#tab-overview').click();
  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: true });
});

test('pause and resume preserve progress; reset cancels pending steps', async ({ page }) => {
  await page.locator('#resetBtn').click(); await page.locator('#runBtn').click();
  await expect.poll(async () => Number(await page.locator('#iteration').textContent())).toBeGreaterThan(3);
  await page.locator('#runBtn').click(); const paused = Number(await page.locator('#iteration').textContent());
  await expect(page.locator('#runStatus')).toHaveText('Paused');
  await page.waitForTimeout(150); await expect(page.locator('#iteration')).toHaveText(String(paused));
  await page.locator('#runBtn').click(); await expect.poll(async () => Number(await page.locator('#iteration').textContent())).toBeGreaterThan(paused);
  await page.locator('#resetBtn').click(); await page.waitForTimeout(150);
  await expect(page.locator('#iteration')).toHaveText('0'); await expect(page.locator('#runStatus')).toHaveText('Ready');
});

test('budget completion and run-again start a fresh reproducible experiment', async ({ page }) => {
  await page.locator('#maxIterations').evaluate(el => { el.value = '20'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#runBtn').click(); await expect(page.locator('#runStatus')).toHaveText('Budget complete');
  const best = await page.locator('#bestEnergy').textContent();
  await page.locator('#runBtn').click(); await expect.poll(async () => Number(await page.locator('#iteration').textContent())).toBeLessThan(20);
  await expect(page.locator('#runStatus')).toHaveText('Budget complete'); await expect(page.locator('#bestEnergy')).toHaveText(best);
});

test('changing architecture resets dimensions, bounds slices and cancels a running job', async ({ page }) => {
  await page.locator('#resetBtn').click(); await page.locator('#runBtn').click();
  await page.locator('#problemSelect').selectOption('ising');
  await page.locator('#qubits').selectOption('6'); await page.locator('#layers').selectOption('5');
  await expect(page.locator('#setupParams')).toHaveText('30'); await expect(page.locator('#iteration')).toHaveText('0');
  await page.locator('#tab-parameters').click(); await expect(page.locator('.parameter-cell')).toHaveCount(30);
  await page.locator('#tab-landscape').click(); await expect(page.locator('#sliceX option')).toHaveCount(30);
  await page.locator('#sliceX').selectOption('29'); await page.locator('#sliceY').selectOption('29');
  expect(await page.locator('#sliceX').inputValue()).not.toBe(await page.locator('#sliceY').inputValue());
  await page.locator('#problemSelect').selectOption('h2'); await expect(page.locator('#qubits')).toBeDisabled();
  await expect(page.locator('#setupParams')).toHaveText('6');
});

test('optimizer comparison reports real same-seed results and clears on config changes', async ({ page }) => {
  await page.locator('#tab-experiments').click(); await page.locator('#compareBtn').click();
  await expect(page.locator('#comparisonRows tr')).toHaveCount(3);
  await expect(page.locator('#comparisonRows')).toContainText('1301'); await expect(page.locator('#comparisonRows')).toContainText('301');
  await expect(page.locator('#comparisonRows tr').first()).toContainText('-1.857267');
  await page.locator('#optimizerSelect').selectOption('SPSA');
  await expect(page.locator('#comparisonRows')).toContainText('Run a comparison');
});

test('JSON and CSV export actual data; imports recompute instead of trusting energies', async ({ page }) => {
  const jsonEvent = page.waitForEvent('download'); await page.locator('#exportJsonBtn').click();
  const jsonFile = await jsonEvent; const data = JSON.parse(await fs.readFile(await jsonFile.path(), 'utf8'));
  expect(data.history.length).toBe(101); expect(data.best).toBeCloseTo(-1.8572669744422758, 10);
  const csvEvent = page.waitForEvent('download'); await page.locator('#exportCsvBtn').click();
  const csvFile = await csvEvent; const csv = await fs.readFile(await csvFile.path(), 'utf8');
  expect(csv.trim().split('\n').length).toBe(102); expect(csv).toContain('theta_5');
  data.best = -999; data.history.forEach(row => { row.energy = -999; });
  await page.locator('#importFile').setInputFiles({ name: 'run.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.locator('#runStatus')).toHaveText('Imported · recomputed');
  await expect(page.locator('#bestEnergy')).toHaveText('-1.85727');
  const expected = VQE.createRun(data.config); while (expected.step()) { /* regenerate trace */ }
  expect(data.config).toEqual(expected.config);
});

test('invalid files and seed values display errors without breaking the current experiment', async ({ page }) => {
  await page.locator('#importFile').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.locator('#notice')).toHaveText('Invalid JSON file.');
  await page.locator('#seed').fill('-1'); await page.locator('#seed').press('Tab');
  await expect(page.locator('#notice')).toContainText('Seed must be');
  await page.locator('#runBtn').click(); await expect(page.locator('#iteration')).toHaveText('100');
  await page.locator('#seed').fill('0'); await page.locator('#seed').press('Tab');
  await expect(page.locator('#iteration')).toHaveText('0');
  await page.locator('#runBtn').click();
  await expect.poll(async () => Number(await page.locator('#iteration').textContent())).toBeGreaterThan(0);
  await page.locator('#seed').fill('-1'); await page.locator('#seed').press('Tab');
  await expect(page.locator('#runStatus')).toHaveText('Invalid setup');
  const paused = await page.locator('#iteration').textContent();
  await page.waitForTimeout(150); await expect(page.locator('#iteration')).toHaveText(paused);
});

test('notebook survives reload and replays the saved experiment', async ({ page }) => {
  await page.locator('#tab-experiments').click(); await page.locator('#saveRunBtn').click();
  await expect(page.locator('.saved-row')).toHaveCount(1); await page.reload();
  await page.locator('#tab-experiments').click(); await expect(page.locator('.saved-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(page.locator('#runStatus')).toHaveText('Replayed run'); await expect(page.locator('#bestEnergy')).toHaveText('-1.85727');
  await page.locator('#tab-experiments').click(); await page.getByRole('button', { name: 'Remove saved run 1' }).click();
  await expect(page.locator('.saved-row')).toHaveCount(0);
});

test('shared links replay seed zero and reject out-of-range work', async ({ page }) => {
  await page.goto('/?problem=h2&seed=0&iterations=20&step=20'); await expect(page.locator('#runStatus')).toHaveText('Shared setup');
  await expect(page.locator('#seed')).toHaveValue('0'); await expect(page.locator('#iteration')).toHaveText('20');
  await page.goto('/?problem=h2&qubits=99'); await expect(page.locator('#notice')).toContainText('Invalid shared setup');
  await expect(page.locator('#runStatus')).toHaveText('Ready');
});

test('theme, keyboard tabs and numerical data are usable', async ({ page }) => {
  await page.locator('#themeBtn').click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('#tab-overview').focus(); await page.keyboard.press('ArrowDown');
  await expect(page.locator('#tab-landscape')).toBeFocused(); await expect(page.locator('#landscape')).toBeVisible();
  await page.keyboard.press('Home'); await page.locator('#showDataBtn').click();
  await expect(page.locator('#traceRows tr')).toHaveCount(101); await page.keyboard.press('Escape');
  await expect(page.locator('#dataDialog')).not.toBeVisible();
});

test('blocked local storage and direct file loading are supported', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } }); });
  await page.goto('file://' + path.resolve(__dirname, '../../index.html') + '?example=1');
  await expect(page.locator('#bestEnergy')).toHaveText('-1.85727');
  await page.locator('#tab-experiments').click(); await page.locator('#saveRunBtn').click();
  await expect(page.locator('#notice')).toContainText('kept in memory');
});

test('WCAG A/AA checks pass in each analysis view and theme', async ({ page }) => {
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.locator('#themeBtn').click();
    for (const view of ['overview', 'landscape', 'circuit', 'parameters', 'experiments']) {
      await page.locator(`#tab-${view}`).click();
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
    }
  }
});
