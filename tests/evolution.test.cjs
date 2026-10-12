const { test } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../engine.js');
const evolution = require('../evolution.js');
const config = { problem: 'ising', qubits: 4, layers: 3, optimizer: 'Adam', learningRate: 0.08, iterations: 20, seed: 42 };

test('evolution continues beyond the budget, retains improvements, and actually changes starts', () => {
  let seed = 1;
  const search = evolution.createEvolution(config, { seedFactory: () => seed++ });
  const initial = search.best, starts = new Map();
  for (let i = 0; i < 160; i++) {
    const before = search.best;
    search.step();
    assert.ok(search.best <= before);
    starts.set(search.sessionCycle, search.run.history[0].parameters);
  }
  assert.equal(search.cycle, 8); assert.equal(search.totalIterations, 160);
  assert.ok(search.best < initial - 1); assert.equal(starts.size, 8);
  assert.notDeepEqual(starts.get(1), starts.get(2));
  assert.ok(search.best >= search.run.problem.reference - 1e-9);
  assert.notEqual(search.radius, 0.35);
});
test('memory resumes a learned solution and re-evaluates forged energy scores', () => {
  let seed = 3;
  const a = evolution.createEvolution(config, { seedFactory: () => seed++ });
  for (let i = 0; i < 120; i++) a.step();
  const memory = a.memory(), actualBest = a.best;
  memory.best = -999;
  const b = evolution.createEvolution(config, { memory, seedFactory: () => 900 });
  assert.ok(Math.abs(b.best - actualBest) < 1e-10);
  assert.equal(b.run.config.seed, 900); assert.equal(b.totalIterations, 120);
  assert.equal(b.strategy, 'Mutate learned best');
  for (let i = 0; i < 20; i++) b.step();
  assert.ok(b.best <= actualBest + 1e-10);
});
test('memory is isolated by objective and circuit shape; invalid parameters are rejected', () => {
  const search = evolution.createEvolution(config, { seedFactory: () => 1 });
  assert.throws(() => evolution.validateMemory(search.memory(), { ...config, qubits: 5 }), /different circuit/);
  assert.throws(() => evolution.validateMemory(search.memory(), { ...config, problem: 'maxcut' }), /different circuit/);
  assert.throws(() => evolution.validateMemory({ ...search.memory(), bestParameters: [NaN] }, config));
  const otherOptimizer = evolution.validateMemory(search.memory(), { ...config, optimizer: 'SPSA' });
  assert.ok(Number.isFinite(otherOptimizer.best));
});
test('stagnation expands mutation radius and triggers global restarts', () => {
  const c = { ...config, problem: 'maxcut', qubits: 2, layers: 1 };
  const memory = { version: 'ry-cx-objectives-v1', key: evolution.key(c), bestParameters: [0, Math.PI], radius: 0.35, completedCycles: 0, totalIterations: 0, stalledCycles: 0 };
  let seed = 5;
  const search = evolution.createEvolution(c, { memory, seedFactory: () => seed++ });
  for (let i = 0; i < 81; i++) search.step();
  assert.equal(search.best, -1);
  assert.ok(search.radius > 0.35); assert.equal(search.strategy, 'Global restart');
});
test('long sessions have bounded history and random-seed API returns valid fresh values', () => {
  let seed = 2;
  const search = evolution.createEvolution({ ...config, problem: 'h2', qubits: 2 }, { seedFactory: () => seed++, maxTrace: 30 });
  for (let i = 0; i < 100; i++) search.step();
  assert.equal(search.trace.length, 30); assert.equal(search.trace[0].iteration, 71);
  const seeds = Array.from({ length: 10 }, evolution.randomSeed);
  seeds.forEach(value => assert.ok(Number.isInteger(value) && value >= 0 && value <= 4294967295));
  assert.ok(new Set(seeds).size > 1);
});
for (const optimizer of engine.OPTIMIZERS) test(`${optimizer} replays a warm-start cycle with its exported initial angles`, () => {
  const c = { ...config, optimizer }, initialParameters = Array.from({ length: 12 }, (_, i) => i * 0.3);
  const a = engine.createRun(c, { initialParameters }); for (let i = 0; i < 20; i++) a.step();
  const snapshot = a.snapshot(), b = engine.createRun(snapshot.config, { initialParameters: snapshot.initialParameters });
  while (b.step()) { /* exact replay of the warm-start cycle */ }
  assert.deepEqual(a.snapshot(), b.snapshot());
});
