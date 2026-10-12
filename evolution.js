/* global VQE */
// Stochastic multi-start search with a retained elite and adaptive mutation radius.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.VQEEvolution = factory(VQE);
}(globalThis, function (engine) {
  'use strict';
  const version = 'ry-cx-objectives-v1';
  const wrap = p => ((p + Math.PI) % engine.TAU + engine.TAU) % engine.TAU - Math.PI;
  const key = config => `${version}:${config.problem}:${config.qubits}:${config.layers}`;

  function randomSeed() {
    if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
    return Math.floor(Math.random() * 4294967296);
  }
  function validateMemory(memory, config) {
    if (!memory || memory.version !== version || memory.key !== key(config)) throw new Error('Learning memory belongs to a different circuit or objective.');
    const bestParameters = engine.validateParameters(memory.bestParameters, config).map(wrap);
    const problem = engine.createProblem(config.problem, config.qubits);
    const best = problem.energy(engine.simulate(bestParameters, config.qubits, config.layers));
    const integer = n => Number.isSafeInteger(n) && n >= 0 && n <= 1e9 ? n : 0;
    return { version, key: key(config), bestParameters, best, completedCycles: integer(memory.completedCycles), totalIterations: integer(memory.totalIterations), stalledCycles: integer(memory.stalledCycles), radius: Number.isFinite(memory.radius) ? Math.min(2.5, Math.max(0.025, memory.radius)) : 0.35 };
  }
  function createEvolution(input, options = {}) {
    const config = engine.validateConfig(input);
    const memory = options.memory ? validateMemory(options.memory, config) : null;
    const seedFactory = options.seedFactory || randomSeed;
    const maxTrace = Math.min(1200, Math.max(2, options.maxTrace || 1200));
    let run, bestParameters = memory?.bestParameters, best = memory?.best ?? Infinity;
    let completedCycles = memory?.completedCycles || 0, totalIterations = memory?.totalIterations || 0;
    let stalledCycles = memory?.stalledCycles || 0, radius = memory?.radius || 0.35;
    let cycle = 0, cycleStartBest, strategy, lastSeed, previousEvaluations = 0;
    let initialBest, trace = [], improvements = 0;
    function acceptCandidate() {
      if (run.best < best) { best = run.best; bestParameters = run.bestParameters.map(wrap); improvements++; }
    }
    function nextCycle() {
      if (run) {
        previousEvaluations += run.evaluations;
        completedCycles++;
        const improved = cycleStartBest - best > 1e-7;
        stalledCycles = improved ? 0 : stalledCycles + 1;
        radius = Math.min(2.5, Math.max(0.025, radius * (improved ? 0.8 : 1.35)));
      }
      let seed = seedFactory();
      if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error('Invalid evolution seed.');
      if (seed === lastSeed) seed = (seed + 0x9E3779B9) >>> 0;
      lastSeed = seed;
      const random = engine.seededRandom(seed), next = { ...config, seed };
      cycleStartBest = best;
      cycle++;
      // Periodic global restarts prevent the retained elite from becoming a fixed point.
      const restart = !bestParameters || (cycle === 1 && options.globalRestart) || completedCycles % 5 === 4 || stalledCycles >= 4;
      strategy = restart ? 'Global restart' : 'Mutate learned best';
      if (restart) stalledCycles = 0;
      const initialParameters = restart ? undefined : bestParameters.map(p => {
        const normal = Math.sqrt(-2 * Math.log(Math.max(1e-12, random()))) * Math.cos(engine.TAU * random());
        return wrap(p + radius * normal);
      });
      run = engine.createRun(next, { initialParameters });
      acceptCandidate();
      if (initialBest === undefined) {
        initialBest = best;
        trace.push({ iteration: totalIterations, energy: run.initial, best, parameters: run.parameters, cycle });
      }
    }
    nextCycle();
    return {
      get run() { return run; }, get trace() { return trace; },
      get best() { return best; }, get bestParameters() { return [...bestParameters]; },
      get cycle() { return completedCycles + 1; }, get sessionCycle() { return cycle; },
      get totalIterations() { return totalIterations; }, get radius() { return radius; },
      get strategy() { return strategy; }, get improvements() { return improvements; },
      get evaluations() { return previousEvaluations + run.evaluations; },
      get initialBest() { return initialBest; },
      step() {
        if (run.iteration >= run.config.iterations) nextCycle();
        run.step(); totalIterations++; acceptCandidate();
        trace.push({ iteration: totalIterations, energy: run.history.at(-1).energy, best, parameters: run.parameters, cycle });
        if (trace.length > maxTrace) trace.splice(0, trace.length - maxTrace);
      },
      memory() {
        return { version, key: key(config), bestParameters: [...bestParameters], best, completedCycles, totalIterations, stalledCycles, radius };
      }
    };
  }
  return { randomSeed, key, validateMemory, createEvolution };
}));
