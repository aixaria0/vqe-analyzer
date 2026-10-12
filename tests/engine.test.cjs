const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const VQE = require('../engine.js');
const config = { problem: 'h2', qubits: 2, layers: 3, optimizer: 'Adam', learningRate: 0.08, iterations: 100, seed: 42 };
const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
const complete = input => { const run = VQE.createRun(input); while (run.step()) { /* exhaust the configured budget */ } return run; };

test('RY and CX produce an analytic Bell state with preserved normalization', () => {
  const state = VQE.simulate([Math.PI / 2, 0], 2, 1);
  close(state[0], Math.SQRT1_2); close(state[3], Math.SQRT1_2);
  close(state[1], 0); close(state[2], 0);
  close(state.reduce((s, x) => s + x * x, 0), 1);
  close(VQE.expectation(state, [['ZZ', 1]]), 1);
  close(VQE.expectation(state, [['XX', 1]]), 1);
  close(VQE.expectation(state, [['IZ', 1]]), 0);
});
test('bit order is q[n-1] … q[0]', () => {
  const state = VQE.simulate([0, Math.PI], 2, 1);
  close(state[2], 1); close(VQE.expectation(state, [['ZI', 1]]), -1); close(VQE.expectation(state, [['IZ', 1]]), 1);
});
test('Jacobi references match analytic spectra, including degeneracy', () => {
  close(VQE.minimumEigenvalue([[2, 1], [1, 2]]), 1);
  close(VQE.minimumEigenvalue([[2, -1, -1], [-1, 2, -1], [-1, -1, 2]]), 0);
  close(VQE.createProblem('h2', 2).reference, -1.8572750302023797);
  close(VQE.createProblem('ising', 2).reference, -Math.sqrt(1 + 4 * 0.7 ** 2));
  close(VQE.createProblem('maxcut', 4).reference, -4);
  close(VQE.createProblem('maxcut', 5).reference, -4);
  close(VQE.createProblem('maxcut', 2).reference, -1);
  close(VQE.createProblem('portfolio', 4).reference, -0.145);
});
test('all problem families respect normalization and the variational bound at 2–6 qubits', () => {
  for (const problem of VQE.PROBLEMS) for (let qubits = 2; qubits <= 6; qubits++) {
    if (problem.id === 'h2' && qubits !== 2) continue;
    const p = VQE.createProblem(problem.id, qubits), random = VQE.seededRandom(123);
    for (let i = 0; i < 5; i++) {
      const state = VQE.simulate(Array.from({ length: qubits * 3 }, () => random() * VQE.TAU), qubits, 3);
      close(state.reduce((s, x) => s + x * x, 0), 1);
      assert.ok(p.energy(state) >= p.reference - 1e-9);
    }
  }
});
test('parameter-shift gradients agree with independent finite differences', () => {
  for (const p of VQE.PROBLEMS) {
    const run = VQE.createRun({ ...config, problem: p.id, qubits: p.qubits });
    const parameters = run.parameters, gradient = VQE.gradient(parameters, run.objective), epsilon = 1e-6;
    parameters.forEach((_, i) => {
      const plus = [...parameters], minus = [...parameters]; plus[i] += epsilon; minus[i] -= epsilon;
      close(gradient[i], (run.objective(plus) - run.objective(minus)) / (2 * epsilon), 1e-7);
    });
  }
});
for (const optimizer of VQE.OPTIMIZERS) test(`${optimizer} is deterministic, budgeted, and counts actual objective calls`, () => {
  const a = complete({ ...config, optimizer }), b = complete({ ...config, optimizer });
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.equal(a.iteration, 100); assert.equal(a.step(), false); assert.equal(a.history.length, 101);
  assert.equal(a.evaluations, 1 + 100 * (optimizer === 'SPSA' ? 3 : 2 * 6 + 1));
  a.history.forEach((row, i) => { assert.ok(Number.isFinite(row.energy)); assert.ok(row.best >= a.problem.reference - 1e-10); if (i) assert.ok(row.best <= a.history[i - 1].best); });
  assert.ok(a.best < a.initial);
});
test('Adam reaches the H2 ground state and learning rate affects its trajectory', () => {
  const a = complete(config), b = complete({ ...config, learningRate: 0.02 });
  assert.ok(a.best - a.problem.reference < 1e-5);
  assert.notDeepEqual(a.history, b.history);
  assert.notDeepEqual(a.history[0].parameters, VQE.createRun({ ...config, seed: 0 }).parameters);
});
test('pause-equivalent split stepping preserves the exact trajectory', () => {
  const a = VQE.createRun(config); for (let i = 0; i < 17; i++) a.step();
  const iteration = a.iteration; assert.equal(iteration, 17);
  while (a.step()) { /* resume the remaining iterations */ } assert.deepEqual(a.snapshot(), complete(config).snapshot());
});
test('snapshot is an independent copy and dimensions follow circuit settings', () => {
  const run = VQE.createRun({ ...config, problem: 'ising', qubits: 6, layers: 5 });
  assert.equal(run.parameters.length, 30);
  const snapshot = run.snapshot(); snapshot.history[0].parameters[0] = 99; snapshot.config.seed = 0;
  assert.notEqual(run.parameters[0], 99); assert.equal(run.config.seed, 42);
  assert.deepEqual(VQE.circuitStats(2, 3), { rotations: 6, entanglers: 3, parameters: 6, totalGates: 9, depth: 6, stateBytes: 32 });
});
test('invalid imports cannot introduce unbounded work or nonfinite settings', () => {
  for (const invalid of [{ problem: 'bad' }, { qubits: 3 }, { qubits: 100 }, { layers: -1 }, { optimizer: 'COBYLA' }, { seed: -1 }, { seed: 2 ** 32 }, { seed: NaN }, { iterations: 301 }, { iterations: 0 }, { learningRate: Infinity }]) assert.throws(() => VQE.validateConfig({ ...config, ...invalid }));
  assert.throws(() => VQE.simulate([NaN, 0], 2, 1));
});
test('independent NumPy H2 optimizer agrees with JavaScript for all optimizers', { skip: !process.env.VQE_PYTHON_PARITY }, () => {
  for (const optimizer of VQE.OPTIMIZERS) {
    const script = 'import json,sys; from vqe_solver import run_vqe; print(json.dumps(run_vqe(seed=42,iterations=20,optimizer=sys.argv[1])))';
    const reference = JSON.parse(execFileSync('python3', ['-c', script, optimizer], { cwd: require('node:path').resolve(__dirname, '..'), encoding: 'utf8' }));
    const actual = complete({ ...config, optimizer, iterations: 20 }).snapshot();
    close(actual.reference, reference.reference); close(actual.best, reference.best);
    assert.equal(actual.evaluations, reference.evaluations);
    actual.history.forEach((row, i) => { close(row.energy, reference.history[i].energy); row.parameters.forEach((p, j) => close(p, reference.history[i].parameters[j])); });
  }
});
