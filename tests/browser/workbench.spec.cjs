const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs/promises');
const path = require('node:path');
const VQE = require('../../engine.js');

test.beforeEach(async ({ page }) => {
  await page.goto('/?example=1');
  await expect(page.locator('#runStatus')).toHaveText('Example complete');
});

test('freshly computed example, views and layouts work without external requests', async ({ page }, testInfo) => {
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:8000')) external.push(request.url()); });
  await page.reload();
  expect(Number(await page.locator('#bestEnergy').textContent())).toBeGreaterThanOrEqual(-1.85728);
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

test('budget completion and run-again generate fresh randomness', async ({ page }) => {
  await page.locator('#maxIterations').evaluate(el => { el.value = '20'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#runBtn').click(); await expect(page.locator('#runStatus')).toHaveText('Budget complete');
  const seed = await page.locator('#seed').inputValue();
  await page.locator('#runBtn').click(); await expect.poll(async () => Number(await page.locator('#iteration').textContent())).toBeLessThan(20);
  await expect(page.locator('#runStatus')).toHaveText('Budget complete'); expect(await page.locator('#seed').inputValue()).not.toBe(seed);
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
  expect(Number(await page.locator('#comparisonRows tr').first().locator('td').nth(1).textContent())).toBeGreaterThanOrEqual(-1.85728);
  await page.locator('#optimizerSelect').selectOption('SPSA');
  await expect(page.locator('#comparisonRows')).toContainText('Run a comparison');
});

test('JSON and CSV export actual data; imports recompute instead of trusting energies', async ({ page }) => {
  const jsonEvent = page.waitForEvent('download'); await page.locator('#exportJsonBtn').click();
  const jsonFile = await jsonEvent; const data = JSON.parse(await fs.readFile(await jsonFile.path(), 'utf8'));
  expect(data.history.length).toBe(101); expect(data.best).toBeGreaterThanOrEqual(-1.85727503020238 - 1e-9);
  const csvEvent = page.waitForEvent('download'); await page.locator('#exportCsvBtn').click();
  const csvFile = await csvEvent; const csv = await fs.readFile(await csvFile.path(), 'utf8');
  expect(csv.trim().split('\n').length).toBe(102); expect(csv).toContain('theta_5');
  data.best = -999; data.history.forEach(row => { row.energy = -999; });
  await page.locator('#importFile').setInputFiles({ name: 'run.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.locator('#runStatus')).toHaveText('Imported learning restored');
  const verified = Math.min(...data.history.map(row => VQE.createProblem('h2', 2).energy(VQE.simulate(row.parameters, 2, 3))));
  expect(Number(await page.locator('#bestEnergy').textContent())).toBeCloseTo(verified, 4);
  expect(await page.locator('#seed').inputValue()).not.toBe(String(data.config.seed));
  await expect(page.locator('#runMode')).toHaveValue('live');
});

test('invalid files display errors and seeds cannot be edited', async ({ page }) => {
  await page.locator('#importFile').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.locator('#notice')).toHaveText('Invalid JSON file.');
  await expect(page.locator('#seed')).toHaveAttribute('readonly', '');
  await expect(page.locator('#runMode option')).toHaveCount(2);
});

test('notebook survives reload and restores parameters for fresh exploration', async ({ page }) => {
  await page.locator('#tab-experiments').click(); await page.locator('#saveRunBtn').click();
  await expect(page.locator('.saved-row')).toHaveCount(1); await page.reload();
  await page.locator('#tab-experiments').click(); await expect(page.locator('.saved-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Continue search', exact: true }).click();
  await expect(page.locator('#runStatus')).toHaveText('Saved learning restored'); expect(Number(await page.locator('#bestEnergy').textContent())).toBeGreaterThanOrEqual(-1.85728);
  await page.locator('#tab-experiments').click(); await page.getByRole('button', { name: 'Remove saved run 1' }).click();
  await expect(page.locator('.saved-row')).toHaveCount(0);
});

test('legacy shared links start fresh live exploration and reject invalid circuits', async ({ page }) => {
  await page.goto('/?problem=h2&seed=0&iterations=20&step=20');
  await expect(page.locator('#runMode')).toHaveValue('live');
  await expect(page.locator('#runStatus')).toContainText('Learning');
  expect(await page.locator('#seed').inputValue()).not.toBe('0');
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
  expect(Number(await page.locator('#bestEnergy').textContent())).toBeGreaterThanOrEqual(-1.85728);
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
