# VQE Analyzer contributor instructions

This is a static quantum optimization workbench. Keep the browser app independent of npm packages, CDNs and network services. Opening index.html directly must continue to work. There is no build output.

- engine.js contains the real-amplitude statevector, Hamiltonians, reference diagonalization and deterministic optimizers. It is available as VQE in the browser and through CommonJS in numerical tests.
- charts.js renders actual experiment data with canvas. Do not introduce fabricated scores or claim projected slices are full-dimensional landscapes.
- app.js owns UI lifecycle, cancellable iteration scheduling, configuration resets, notebook, import/export and shared setup replay.
- vqe_solver.py independently implements the H2 experiment in NumPy; VQE-SOLVER.py is its compatibility entry point.
- H2 reports electronic energy without nuclear repulsion. All circuits are noiseless and run locally. The portfolio is a toy objective; MaxCut uses an RY/CX ansatz rather than QAOA.

Use Node 22+. Run npm ci, npm run lint and npm test. For browser validation, run npx playwright install chromium and npm run test:e2e. For Python and cross-language checks, install requirements.txt, run npm run test:python and VQE_PYTHON_PARITY=1 npm test.

Validate desktop, tablet and mobile layouts. Retain keyboard tab navigation, semantic labels, optional browser storage, and JSON replay that recomputes results. Changing configuration must reset shapes, cancel pending work and invalidate comparisons. All new numerical claims require reproducible tests.

Live evolution is the default: new stochastic seeds, retained elite parameters, adaptive mutation radius and periodic global restarts. Keep fixed seed replay an explicit option; never replace live exploration with a fixed demo. Evolution memory is scoped by Hamiltonian and circuit dimensions and its scores must be recomputed before use. Export/import and shared links must retain actual initial angles for warm-start replay. Bound live trace memory and pause hidden tabs.
