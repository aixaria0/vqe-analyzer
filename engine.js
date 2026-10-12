/* A real-amplitude statevector simulator. No network or quantum service required. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VQE = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TAU = 2 * Math.PI;
  const PROBLEMS = [
    { id: 'h2', name: 'Hydrogen molecule', short: 'H₂ molecule', category: 'QUANTUM CHEMISTRY', qubits: 2, layers: 3, unit: 'Ha', description: 'A two-qubit electronic Hamiltonian for H₂ at 0.735 Å. Nuclear repulsion is excluded.' },
    { id: 'ising', name: 'Transverse-field Ising', short: 'Ising chain', category: 'MANY-BODY PHYSICS', qubits: 4, layers: 3, unit: 'a.u.', description: 'An open spin chain with nearest-neighbor coupling J = 1 and transverse field h = 0.7.' },
    { id: 'maxcut', name: 'Graph partitioning', short: 'MaxCut ring', category: 'COMBINATORIAL OPTIMIZATION', qubits: 4, layers: 3, unit: 'cost', description: 'Minimize the negative expected cut of an unweighted ring graph. This uses a hardware-efficient ansatz, not QAOA.' },
    { id: 'portfolio', name: 'Portfolio selection', short: 'Portfolio', category: 'DISCRETE OPTIMIZATION', qubits: 4, layers: 3, unit: 'cost', description: 'A toy binary allocation objective: risk minus return, with a penalty for deviating from a two-asset budget.' }
  ];
  const OPTIMIZERS = ['Adam', 'Gradient descent', 'SPSA'];

  function seededRandom(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function validateConfig(config) {
    if (!PROBLEMS.some(p => p.id === config.problem)) throw new Error('Unknown problem.');
    if (!Number.isInteger(config.qubits) || config.qubits < 2 || config.qubits > 6) throw new Error('Qubits must be between 2 and 6.');
    if (config.problem === 'h2' && config.qubits !== 2) throw new Error('The H₂ Hamiltonian requires exactly two qubits.');
    if (!Number.isInteger(config.layers) || config.layers < 1 || config.layers > 5) throw new Error('Layers must be between 1 and 5.');
    if (!OPTIMIZERS.includes(config.optimizer)) throw new Error('Unknown optimizer.');
    if (!Number.isFinite(config.learningRate) || config.learningRate < 0.005 || config.learningRate > 0.5) throw new Error('Learning rate must be between 0.005 and 0.5.');
    if (!Number.isInteger(config.iterations) || config.iterations < 20 || config.iterations > 300) throw new Error('Iteration budget must be between 20 and 300.');
    if (!Number.isInteger(config.seed) || config.seed < 0 || config.seed > 4294967295) throw new Error('Seed must be a 32-bit unsigned integer.');
    return { problem: config.problem, qubits: config.qubits, layers: config.layers, optimizer: config.optimizer, learningRate: config.learningRate, iterations: config.iterations, seed: config.seed };
  }

  function applyRY(state, qubit, angle) {
    const mask = 1 << qubit;
    const c = Math.cos(angle / 2), s = Math.sin(angle / 2);
    for (let i = 0; i < state.length; i++) {
      if (i & mask) continue;
      const j = i | mask, a = state[i], b = state[j];
      state[i] = c * a - s * b;
      state[j] = s * a + c * b;
    }
  }

  function applyCNOT(state, control, target) {
    for (let i = 0; i < state.length; i++) {
      if ((i & (1 << control)) && !(i & (1 << target))) {
        const j = i ^ (1 << target), a = state[i];
        state[i] = state[j];
        state[j] = a;
      }
    }
  }

  function simulate(parameters, qubits, layers) {
    if (parameters.length !== qubits * layers || parameters.some(x => !Number.isFinite(x))) throw new Error('Invalid circuit parameters.');
    const state = new Float64Array(1 << qubits);
    state[0] = 1;
    for (let layer = 0; layer < layers; layer++) {
      for (let q = 0; q < qubits; q++) applyRY(state, q, parameters[layer * qubits + q]);
      for (let q = 0; q < qubits - 1; q++) applyCNOT(state, q, q + 1);
    }
    return state;
  }

  // Pauli strings are written q[n-1] … q[0]; displayed bitstrings use the same order.
  function pauliTransition(word, index) {
    let target = index, sign = 1;
    for (let q = 0; q < word.length; q++) {
      const operator = word[word.length - 1 - q];
      if (operator === 'X') target ^= 1 << q;
      if (operator === 'Z' && (index & (1 << q))) sign *= -1;
    }
    return [target, sign];
  }

  function expectation(state, terms) {
    let energy = 0;
    for (const [word, coefficient] of terms) {
      let value = 0;
      for (let i = 0; i < state.length; i++) {
        const [j, sign] = pauliTransition(word, i);
        value += sign * state[i] * state[j];
      }
      energy += coefficient * value;
    }
    return energy;
  }

  function minimumEigenvalue(matrix) {
    // Cyclic Jacobi diagonalization of a small real symmetric Hamiltonian.
    const a = matrix.map(row => [...row]), n = a.length;
    for (let sweep = 0; sweep < 50; sweep++) {
      let largest = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        const apq = a[p][q];
        largest = Math.max(largest, Math.abs(apq));
        if (Math.abs(apq) < 1e-12) continue;
        const angle = 0.5 * Math.atan2(2 * apq, a[q][q] - a[p][p]);
        const c = Math.cos(angle), s = Math.sin(angle);
        const app = a[p][p], aqq = a[q][q];
        a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
        a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
        a[p][q] = a[q][p] = 0;
        for (let k = 0; k < n; k++) {
          if (k === p || k === q) continue;
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = a[p][k] = c * akp - s * akq;
          a[k][q] = a[q][k] = s * akp + c * akq;
        }
      }
      if (largest < 1e-10) return Math.min(...a.map((row, i) => row[i]));
    }
    throw new Error('Exact reference did not converge.');
  }

  const problemCache = new Map();
  function createProblem(id, qubits) {
    const meta = PROBLEMS.find(p => p.id === id);
    if (!meta || !Number.isInteger(qubits) || qubits < 2 || qubits > 6 || (id === 'h2' && qubits !== 2)) throw new Error('Invalid problem configuration.');
    const key = `${id}:${qubits}`;
    if (problemCache.has(key)) return problemCache.get(key);
    let terms = [], diagonal = null;
    const word = (ops) => Array.from({ length: qubits }, (_, i) => ops[qubits - 1 - i] || 'I').join('');
    if (id === 'h2') {
      terms = [['II', -1.052373245772859], ['IZ', 0.39793742484318045], ['ZI', -0.39793742484318045], ['ZZ', -0.01128010425623538], ['XX', 0.18093119978423156]];
    } else if (id === 'ising') {
      for (let q = 0; q < qubits; q++) terms.push([word({ [q]: 'X' }), -0.7]);
      for (let q = 0; q < qubits - 1; q++) terms.push([word({ [q]: 'Z', [q + 1]: 'Z' }), -1]);
    } else {
      diagonal = Array.from({ length: 1 << qubits }, (_, index) => {
        const bits = Array.from({ length: qubits }, (_, q) => (index >>> q) & 1);
        if (id === 'maxcut') {
          // Two vertices have one undirected edge; larger rings have n edges.
          const edges = qubits === 2 ? 1 : qubits;
          return -Array.from({ length: edges }, (_, q) => bits[q] !== bits[(q + 1) % qubits] ? 1 : 0).reduce((a, b) => a + b, 0);
        }
        const returns = [0.12, 0.18, 0.10, 0.15, 0.09, 0.16];
        let cost = 0, count = 0;
        for (let i = 0; i < qubits; i++) {
          count += bits[i];
          cost += (0.06 + i * 0.01 - returns[i]) * bits[i];
          for (let j = i + 1; j < qubits; j++) cost += 0.025 * bits[i] * bits[j];
        }
        return cost + 0.5 * (count - 2) ** 2;
      });
    }
    const size = 1 << qubits;
    const matrix = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => diagonal && i === j ? diagonal[i] : 0));
    for (const [pauli, coefficient] of terms) for (let i = 0; i < size; i++) {
      const [j, sign] = pauliTransition(pauli, i);
      matrix[j][i] += coefficient * sign;
    }
    const problem = {
      ...meta, qubits, terms, diagonal,
      reference: diagonal ? Math.min(...diagonal) : minimumEigenvalue(matrix),
      energy(state) {
        return diagonal ? state.reduce((sum, amplitude, i) => sum + amplitude ** 2 * diagonal[i], 0) : expectation(state, terms);
      }
    };
    problemCache.set(key, problem);
    return problem;
  }

  function gradient(parameters, objective) {
    return parameters.map((_, i) => {
      const plus = [...parameters], minus = [...parameters];
      plus[i] += Math.PI / 2;
      minus[i] -= Math.PI / 2;
      return 0.5 * (objective(plus) - objective(minus));
    });
  }

  function createRun(input) {
    const config = validateConfig(input), problem = createProblem(config.problem, config.qubits);
    const random = seededRandom(config.seed);
    const objective = params => problem.energy(simulate(params, config.qubits, config.layers));
    const params = Array.from({ length: config.qubits * config.layers }, () => random() * TAU - Math.PI);
    let parameters = params, bestParameters = [...params], best = objective(params), evaluations = 1;
    const initial = best, history = [{ iteration: 0, energy: best, best, parameters: [...params] }];
    const m = params.map(() => 0), v = params.map(() => 0);
    function measuredObjective(p) { evaluations++; return objective(p); }
    return {
      config, problem, history,
      get parameters() { return [...parameters]; },
      get bestParameters() { return [...bestParameters]; },
      get iteration() { return history.length - 1; },
      get evaluations() { return evaluations; },
      get best() { return best; },
      get initial() { return initial; },
      objective,
      step() {
        const iteration = history.length;
        if (iteration > config.iterations) return false;
        let g;
        if (config.optimizer === 'SPSA') {
          const ck = 0.1 / iteration ** 0.101;
          const delta = parameters.map(() => random() < 0.5 ? -1 : 1);
          const difference = measuredObjective(parameters.map((p, i) => p + ck * delta[i])) - measuredObjective(parameters.map((p, i) => p - ck * delta[i]));
          g = delta.map(d => difference / (2 * ck * d));
        } else g = gradient(parameters, measuredObjective);
        const rate = config.optimizer === 'SPSA' ? config.learningRate / iteration ** 0.602 : config.learningRate;
        parameters = parameters.map((p, i) => {
          let update = g[i];
          if (config.optimizer === 'Adam') {
            m[i] = 0.9 * m[i] + 0.1 * g[i];
            v[i] = 0.999 * v[i] + 0.001 * g[i] ** 2;
            update = (m[i] / (1 - 0.9 ** iteration)) / (Math.sqrt(v[i] / (1 - 0.999 ** iteration)) + 1e-8);
          }
          return p - rate * update;
        });
        const energy = measuredObjective(parameters);
        if (energy < best) { best = energy; bestParameters = [...parameters]; }
        history.push({ iteration, energy, best, parameters: [...parameters] });
        return true;
      },
      snapshot() {
        return { schemaVersion: 1, engine: 'real-statevector-ry-cnot-v1', config: { ...config }, reference: problem.reference, initial, best, evaluations, bestParameters: [...bestParameters], history: history.map(row => ({ ...row, parameters: [...row.parameters] })) };
      }
    };
  }

  function circuitStats(qubits, layers) {
    return { rotations: qubits * layers, entanglers: (qubits - 1) * layers, parameters: qubits * layers, totalGates: (2 * qubits - 1) * layers, depth: qubits * layers, stateBytes: 8 * (1 << qubits) };
  }

  return { PROBLEMS, OPTIMIZERS, TAU, seededRandom, validateConfig, applyRY, applyCNOT, simulate, expectation, gradient, minimumEigenvalue, createProblem, createRun, circuitStats };
}));
