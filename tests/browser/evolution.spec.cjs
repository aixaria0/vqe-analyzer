const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const engine = require('../../engine.js');
const AxeBuilder = require('@axe-core/playwright').default;

const exportRun = async page => {
  const pending = page.waitForEvent('download'); await page.locator('#exportJsonBtn').click();
  const file = await pending; return JSON.parse(await fs.readFile(await file.path(), 'utf8'));
};
const budget20 = async page => page.locator('#maxIterations').evaluate(input => { input.value = '20'; input.dispatchEvent(new Event('input', { bubbles: true })); });

test('default live search changes seeds, crosses multiple budgets, and pause/resume retains progress', async ({ page }) => {
  await page.clock.install(); await page.goto('/');
  await expect(page.locator('#runMode')).toHaveValue('live');
  await expect(page.locator('#runStatus')).toContainText('Learning');
  await expect(page.locator('#seed')).toHaveAttribute('readonly', '');
  await budget20(page); const firstSeed = await page.locator('#seed').inputValue();
  await page.clock.runFor(2300);
  expect(Number(await page.locator('#learningCycle').textContent())).toBeGreaterThan(2);
  expect(Number(await page.locator('#totalUpdates').textContent())).toBeGreaterThan(40);
  expect(await page.locator('#seed').inputValue()).not.toBe(firstSeed);
  await page.locator('#runBtn').click();
  const steps = await page.locator('#totalUpdates').textContent(), best = Number(await page.locator('#bestEnergy').textContent());
  await page.clock.runFor(500); await expect(page.locator('#totalUpdates')).toHaveText(steps);
  await page.locator('#runBtn').click(); await page.clock.runFor(300);
  expect(Number(await page.locator('#totalUpdates').textContent())).toBeGreaterThan(Number(steps));
  expect(Number(await page.locator('#bestEnergy').textContent())).toBeLessThanOrEqual(best);
});

test('fresh random runs differ; fixed mode remains exactly replayable', async ({ page }) => {
  await page.clock.install(); await page.goto('/?example=1');
  await page.locator('#runMode').selectOption('random'); await budget20(page);
  await page.locator('#runBtn').click(); await page.clock.runFor(1100);
  await expect(page.locator('#runStatus')).toHaveText('Budget complete'); const a = await exportRun(page);
  await page.locator('#runBtn').click(); await page.clock.runFor(1100); const b = await exportRun(page);
  expect(a.config.seed).not.toBe(b.config.seed); expect(a.initialParameters).not.toEqual(b.initialParameters);
  await page.locator('#runMode').selectOption('fixed'); await page.locator('#seed').fill('7'); await page.locator('#seed').press('Tab');
  await page.locator('#runBtn').click(); await page.clock.runFor(1100); const c = await exportRun(page);
  await page.locator('#runBtn').click(); await page.clock.runFor(1100); const d = await exportRun(page);
  expect(c).toEqual(d);
});

test('learned parameters and active setup survive reload; new starts retain the best solution', async ({ page }) => {
  await page.clock.install(); await page.goto('/'); await page.locator('#problemSelect').selectOption('ising'); await budget20(page);
  await page.clock.runFor(2500); await page.locator('#runBtn').click(); const before = await exportRun(page);
  const verified = engine.createProblem('ising', 4).energy(engine.simulate(before.learningCheckpoint.bestParameters, 4, 3));
  expect(verified).toBeCloseTo(before.learningCheckpoint.best, 10);
  await page.reload(); await expect(page.locator('#problemSelect')).toHaveValue('ising');
  await page.locator('#runBtn').click();
  const after = await exportRun(page);
  expect(after.learningCheckpoint.best).toBeLessThanOrEqual(before.learningCheckpoint.best + 1e-10);
  expect(after.config.seed).not.toBe(before.config.seed);
  await page.locator('#newStartBtn').click(); await page.locator('#runBtn').click(); const restart = await exportRun(page);
  expect(restart.learningCheckpoint.best).toBeLessThanOrEqual(after.learningCheckpoint.best + 1e-10);
  expect(restart.initialParameters).not.toEqual(after.initialParameters);
});

test('warm-start JSON replays actual angles and imports a validated learning checkpoint', async ({ page }) => {
  await page.clock.install(); await page.goto('/'); await page.locator('#problemSelect').selectOption('ising'); await budget20(page);
  await page.clock.runFor(1400); await page.locator('#runBtn').click(); const data = await exportRun(page);
  expect(data.evolutionTrace.length).toBeGreaterThan(20); expect(data.learningCheckpoint).toBeTruthy();
  const expected = engine.createRun(data.config, { initialParameters: data.initialParameters });
  for (let i = 0; i < data.history.length - 1; i++) expected.step();
  data.learningCheckpoint.best = -999; data.best = -999; data.history.forEach(row => { row.energy = -999; });
  await page.locator('#importFile').setInputFiles({ name: 'live.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.locator('#runStatus')).toHaveText('Imported · recomputed');
  expect(Number(await page.locator('#bestEnergy').textContent())).toBeCloseTo(expected.best, 4);
  await page.locator('#runMode').selectOption('live'); await page.locator('#runBtn').click();
  expect(Number(await page.locator('#bestEnergy').textContent())).toBeGreaterThan(-100);
});

test('follow landscape resamples the evolving conditional slice and live controls are accessible', async ({ page }) => {
  await page.clock.install(); await page.goto('/'); await page.locator('#tab-landscape').click();
  const before = await page.locator('#landscapeChart').evaluate(canvas => canvas.toDataURL());
  await page.clock.runFor(700);
  const after = await page.locator('#landscapeChart').evaluate(canvas => canvas.toDataURL());
  expect(after).not.toBe(before);
  await page.locator('#runBtn').click();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
});
