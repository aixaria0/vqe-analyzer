# Copilot Cloud Agent: Onboarding & Operation Instructions for `vqe-analyzer`

## 1. Repository Summary

- **Purpose**: High-performance interactive, zero-dependency tool for visualizing and analyzing optimization landscapes (especially Variational Quantum Eigensolver—VQE—problems).
- **Use Cases**: Quantum chemistry (H₂ molecule), QAOA/MaxCut, NISQ Ising, adaptive VQE, quantum ML, and financial portfolio optimization.
- **Audience**: Quantum computing researchers, ML ops, financial researchers.
- **Deployment**: Pure frontend app—open `index.html` or serve over HTTP; includes a pure Python quantum optimization script (`VQE-SOLVER.py`) for IBM Qiskit.

## 2. Repo High-Level Info

- **Main Languages**: JavaScript (Vanilla ES6+), CSS, HTML, Python (for separate solver script).
- **Key Frontend Dependencies**: Chart.js (via CDN in HTML, not npm), *no build step required* for browser use.
- **Linting/Dev**: ESLint (with config: `eslint.config.mjs`, required for PRs or CI).
- **No Backend**: JavaScript runs fully in-browser; no Node.js back-end or API.

**Root Files:**
- `.github/` (actions/templates)
- `.gitignore`
- `README.md`
- `CONTRIBUTING.md`
- `LICENSE`
- `package.json`, `package-lock.json` (for linting only)
- `eslint.config.mjs`
- `index.html`, `style.css`, `app.js` (main app)
- `VQE-SOLVER.py`, `vqe_solver.py` (Qiskit Python demo)

## 3. How to Build, Test, and Validate

### A. Pure Frontend/JS App

- **To launch/test:**  
  Always use a modern browser with JavaScript enabled.
  1. Open `index.html` directly, _or_:
  2. Start a local server (choose one):
     - `python3 -m http.server 8000` then open `http://localhost:8000`
     - `npx http-server` (if Node.js installed)

**No npm install or build step is ever required to run the frontend in the browser.**

- **Linting (PRs, validation, CI):**
  - Always run `npm install` (first time, to get ESLint).
  - To lint: `npm run lint`  
    _(Runs ESLint on all JS files; configured via `eslint.config.mjs`.)_
    - If you see errors about missing config, ensure Node v18+.
  - There are **no automated tests configured** (`npm test` will fail by design).

- **Common errors & mitigation:**
  - If the app does not launch, check for browser JS errors, missing Chart.js CDN, or syntax errors in `app.js`.  
  - Lint only needed for code quality; does not block running the tool in browser.
  - Always check that browser loads index.html with visuals and interactivity.

### B. Python Qiskit Script (`VQE-SOLVER.py`)
- **Requirements**: Python 3.8+, Qiskit (see script for requirements).
- **To run:**  
  1. Install dependencies: `pip install qiskit numpy`
  2. Run: `python VQE-SOLVER.py`
  - Prints optimizer result and convergence stats.
- If Qiskit errors occur, ensure you are using an up-to-date Python/Qiskit.

## 4. Project Layout & Key Architecture Facts

- `index.html`: Main entry, links all tabs/interactivity.
- `style.css`: Custom, zero-dependency styling/CSS Grid.
- `app.js`: All application simulation logic, state, charts, tab navigation.
  - Use case definitions, state machinery, chart management, parameter/landscape calculation.
  - Major functions: `init`, `setupEventListeners`, `startOptimization`, `updateDashboard`, chart rendering.
- `VQE-SOLVER.py`: Pure Python reference implementation with Qiskit, not connected to the frontend.
- Linting config: `eslint.config.mjs` (for modern ESLint—uses ES6, browser JS).

**Validation & CI:**
- No automated build/test validation in CI by default, except that code must be ESLint-clean.
- If using GitHub Actions (none standard, check `.github/`), linting is the expected test.
- For PRs, always perform a manual browser verification by opening `index.html`.
- Always prefer launching the app via a browser or local server for validation.

**Directory structure—a typical root layout:**
```
.vqe-analyzer/
├── .github/
├── .gitignore
├── app.js
├── CONTRIBUTING.md
├── eslint.config.mjs
├── index.html
├── LICENSE
├── package.json
├── package-lock.json
├── README.md
├── style.css
├── VQE-SOLVER.py
├── vqe_solver.py
```

## 5. Trust & Exploration Policy

**Copilot Agent:**
- Trust these onboarding instructions regarding app architecture, build, and validation.
- Only search and infer additional steps if:
  - You are instructed to do something not covered above, or
  - You encounter errors indicating instructions are incorrect or incomplete.

*Never* run blind `npm install` or `npm run build` expecting a productive build: these will not produce a dist output and are not required.
Always manually serve or open `index.html` for the main workflow.

---

If you need to update these instructions, use structural information from new files, updated README/contributing, and build/CI configs. If commands fail, document the error and any successful workarounds here.