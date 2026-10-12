/* global VQE, VQECharts */
'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const defaults = { problem: 'h2', qubits: 2, layers: 3, optimizer: 'Adam', learningRate: 0.08, iterations: 100, seed: 42 };
  const names = { overview: 'Overview', landscape: 'Energy landscape', circuit: 'Quantum circuit', parameters: 'Parameters', experiments: 'Experiments' };
  let run, timer = null, busy = false, activeView = 'overview', computeMs = 0, landscapeData = null;
  let comparison = [], comparisonToken = 0, noticeTimer, resizeFrame;
  let saved = [];
  const configControls = ['problemSelect', 'optimizerSelect', 'learningRate', 'maxIterations', 'qubits', 'layers', 'seed'];

  function readConfig() {
    return VQE.validateConfig({ problem: $('problemSelect').value, optimizer: $('optimizerSelect').value, learningRate: Number($('learningRate').value), iterations: Number($('maxIterations').value), qubits: Number($('qubits').value), layers: Number($('layers').value), seed: $('seed').value.trim() === '' ? NaN : Number($('seed').value) });
  }
  function writeConfig(config) {
    $('problemSelect').value = config.problem; $('optimizerSelect').value = config.optimizer;
    $('learningRate').value = config.learningRate; $('maxIterations').value = config.iterations;
    $('qubits').value = config.qubits; $('layers').value = config.layers; $('seed').value = config.seed;
    $('rateValue').value = Number(config.learningRate).toFixed(3); $('budgetValue').value = config.iterations;
    $('qubits').disabled = config.problem === 'h2';
  }
  function notice(message) {
    $('notice').textContent = message; $('notice').hidden = false;
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 5000);
  }
  function setStatus(label, running = false) {
    $('runStatus').textContent = label; $('runBadge').classList.toggle('running', running);
  }
  function cancelWork() {
    clearTimeout(timer); timer = null; busy = false;
    comparisonToken++; $('compareBtn').disabled = false;
    $('compareBtn').textContent = 'Run comparison ↗';
  }
  function updateButton() {
    $('runBtn').innerHTML = busy ? '<span aria-hidden="true">Ⅱ</span> Pause experiment' : run.iteration >= run.config.iterations ? '<span aria-hidden="true">↺</span> Run again' : run.iteration ? '<span aria-hidden="true">▶</span> Resume experiment' : '<span aria-hidden="true">▶</span> Run experiment';
    $('mobileRunBtn').textContent = $('runBtn').textContent;
  }
  function reset(config = readConfig(), status = 'Ready') {
    cancelWork(); writeConfig(config); run = VQE.createRun(config); computeMs = 0;
    comparison = []; $('comparisonRows').innerHTML = '<tr><td colspan="5" class="empty-cell">Run a comparison to collect actual results.</td></tr>';
    landscapeData = null;
    const options = run.parameters.map((_, i) => new Option(`θ${i} · layer ${Math.floor(i / config.qubits) + 1}`, i));
    $('sliceX').replaceChildren(...options);
    $('sliceY').replaceChildren(...options.map(option => option.cloneNode(true)));
    $('sliceX').value = '0'; $('sliceY').value = '1';
    $('problemCategory').textContent = run.problem.category;
    $('problemNote').textContent = run.problem.description;
    $('setupParams').textContent = run.parameters.length; $('parameterCount').textContent = `${run.parameters.length} angles`;
    $('chartOptimizer').textContent = config.optimizer;
    document.querySelectorAll('[data-unit]').forEach(node => { node.textContent = run.problem.unit; });
    setStatus(status); update(); renderCircuit();
  }
  function update() {
    const current = run.history.at(-1).energy;
    $('currentEnergy').textContent = current.toFixed(5); $('bestEnergy').textContent = run.best.toFixed(5);
    const gap = Math.max(0, run.best - run.problem.reference);
    $('energyGap').textContent = gap < 0.001 ? gap.toExponential(2) : gap.toFixed(5);
    $('referenceLabel').textContent = `Reference ${run.problem.reference.toFixed(6)} ${run.problem.unit}`;
    $('energyChange').textContent = run.iteration ? `${(current - run.initial).toFixed(5)} from initial state` : 'Initial state · seed ' + run.config.seed;
    $('iteration').textContent = run.iteration; $('iterationBudget').textContent = ` / ${run.config.iterations}`;
    $('progressBar').style.width = `${run.iteration / run.config.iterations * 100}%`;
    $('evaluationCount').textContent = `${run.evaluations.toLocaleString()} objective evaluations`;
    $('computeTime').textContent = `${computeMs.toFixed(0)} ms`;
    $('energyChart').setAttribute('aria-label', `Energy at iteration ${run.iteration}: ${current.toFixed(6)} ${run.problem.unit}. Best ${run.best.toFixed(6)}. Exact reference ${run.problem.reference.toFixed(6)}.`);
    updateButton(); renderView();
  }
  function step() {
    if (!busy) return;
    const start = performance.now(); run.step(); computeMs += performance.now() - start;
    if (run.iteration >= run.config.iterations) { busy = false; timer = null; setStatus('Budget complete'); notice('Experiment complete. Save or export the numerical trace.'); }
    update();
    if (busy) timer = setTimeout(step, 35);
  }
  function toggleRun() {
    if (busy) { cancelWork(); setStatus('Paused'); updateButton(); return; }
    try {
      const config = readConfig();
      if (Object.keys(defaults).some(key => config[key] !== run.config[key]) || run.iteration >= run.config.iterations) reset(config);
      comparisonToken++; $('compareBtn').disabled = false; $('compareBtn').textContent = 'Run comparison ↗';
      busy = true; setStatus('Running', true); updateButton(); step();
    } catch (error) { notice(error.message); $('seed').reportValidity(); }
  }
  function example() {
    reset(defaults);
    const start = performance.now(); while (run.step()) { /* compute the example, rather than load fabricated data */ }
    computeMs = performance.now() - start; setStatus('Example · seed 42'); update();
  }
  function switchView(view, focus = false) {
    activeView = view;
    document.querySelectorAll('[role="tab"]').forEach(tab => {
      const selected = tab.dataset.tab === view;
      tab.classList.toggle('active', selected); tab.setAttribute('aria-selected', selected); tab.tabIndex = selected ? 0 : -1;
      if (focus && selected) tab.focus();
    });
    document.querySelectorAll('.view').forEach(panel => { panel.hidden = panel.id !== view; });
    $('viewName').textContent = names[view]; renderView();
  }
  function sampleLandscape() {
    if (landscapeData) return landscapeData;
    const x = Number($('sliceX').value), y = Number($('sliceY').value), size = 32, values = [];
    const params = [...run.history[0].parameters];
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      params[x] = -Math.PI + (i + 0.5) / size * VQE.TAU;
      params[y] = -Math.PI + (j + 0.5) / size * VQE.TAU;
      values.push(run.objective(params));
    }
    landscapeData = { size, values, min: Math.min(...values), max: Math.max(...values) };
    $('landscapeMin').textContent = `${landscapeData.min.toFixed(3)} · LOW`; $('landscapeMax').textContent = `${landscapeData.max.toFixed(3)} · HIGH`;
    return landscapeData;
  }
  function renderView() {
    if (!run) return;
    const colors = VQECharts.palette();
    if (activeView === 'overview') {
      VQECharts.line($('energyChart'), [{ values: run.history.map(r => r.energy) }, { values: run.history.map(r => r.best) }], { reference: run.problem.reference, maxX: run.config.iterations });
      const state = VQE.simulate(run.parameters, run.config.qubits, run.config.layers);
      VQECharts.probabilities($('probabilityChart'), Array.from(state, x => x * x), run.config.qubits);
      $('basisCount').textContent = state.length > 8 ? `Top 8 / ${state.length}` : `${state.length} states`;
      VQECharts.landscape($('miniLandscape'), sampleLandscape(), run.history, Number($('sliceX').value), Number($('sliceY').value));
    } else if (activeView === 'landscape') {
      VQECharts.landscape($('landscapeChart'), sampleLandscape(), run.history, Number($('sliceX').value), Number($('sliceY').value), true);
    } else if (activeView === 'parameters') {
      const series = run.parameters.map((_, i) => ({ values: run.history.map(row => row.parameters[i]), color: [colors.accent, colors.violet, colors.green, '#7eacbf', '#d6b783', '#cf87b7'][i % 6] }));
      VQECharts.line($('parameterChart'), series, { maxX: run.config.iterations, label: 'ANGLE (rad)', fill: false });
      const derivatives = VQE.gradient(run.parameters, run.objective), scale = Math.max(...derivatives.map(Math.abs), 1e-12);
      const cells = run.parameters.map((p, i) => {
        const cell = document.createElement('div'); cell.className = 'parameter-cell';
        cell.innerHTML = `<header><span>θ${i}</span><span>L${Math.floor(i / run.config.qubits) + 1} · q${i % run.config.qubits}</span></header><strong>${p.toFixed(4)} <span class="unit">rad</span></strong><small>∂E/∂θ = ${derivatives[i].toFixed(5)}</small><div class="sensitivity-bar"><i style="width:${Math.abs(derivatives[i]) / scale * 100}%"></i></div>`;
        return cell;
      }); $('parameterGrid').replaceChildren(...cells);
    } else if (activeView === 'experiments') {
      VQECharts.line($('comparisonChart'), comparison.map((r, i) => ({ values: r.history.map(row => row.best), color: [colors.accent, colors.violet, colors.green][i] })), { reference: comparison.length ? comparison[0].problem.reference : undefined, maxX: run.config.iterations });
    }
  }
  function renderCircuit() {
    const { qubits, layers } = run.config, colors = VQECharts.palette();
    const layerWidth = 70 + (qubits - 1) * 30, width = 110 + layers * layerWidth, height = 45 + qubits * 52;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><g font-family="monospace" font-size="10">`;
    for (let q = 0; q < qubits; q++) {
      const y = 43 + q * 52;
      svg += `<text x="0" y="${y + 4}" fill="${colors.text}">q${q} |0⟩</text><line x1="58" y1="${y}" x2="${width - 15}" y2="${y}" stroke="${colors.grid}"/>`;
    }
    for (let l = 0; l < layers; l++) {
      const x = 77 + l * layerWidth;
      svg += `<text x="${x}" y="13" fill="${colors.faint}">LAYER ${l + 1}</text>`;
      for (let q = 0; q < qubits; q++) {
        const y = 43 + q * 52;
        svg += `<rect x="${x}" y="${y - 15}" width="44" height="30" rx="3" fill="${colors.panel}" stroke="${colors.violet}"/><text x="${x + 22}" y="${y + 4}" text-anchor="middle" fill="${colors.violet}">RY θ${l * qubits + q}</text>`;
      }
      for (let q = 0; q < qubits - 1; q++) {
        const cx = x + 62 + q * 30, y1 = 43 + q * 52, y2 = y1 + 52;
        svg += `<line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2}" stroke="${colors.accent}"/><circle cx="${cx}" cy="${y1}" r="3" fill="${colors.accent}"/><circle cx="${cx}" cy="${y2}" r="8" fill="${colors.panel}" stroke="${colors.accent}"/><path d="M${cx - 8} ${y2}h16M${cx} ${y2 - 8}v16" stroke="${colors.accent}"/>`;
      }
    }
    $('circuitDiagram').innerHTML = svg + '</g></svg>';
    $('circuitDiagram').setAttribute('aria-label', `${qubits} qubits; ${layers} layers, each with ${qubits} RY gates followed by ${qubits - 1} sequential controlled-X gates.`);
    const stats = VQE.circuitStats(qubits, layers);
    const metrics = [['TOTAL GATES', stats.totalGates, `${stats.rotations} RY + ${stats.entanglers} CX`], ['CIRCUIT DEPTH', stats.depth, 'Parallel RY; sequential CX'], ['PARAMETERS', stats.parameters, 'One angle per RY gate'], ['STATE DIMENSION', 2 ** qubits, 'Real amplitudes'], ['STATE MEMORY', `${stats.stateBytes} B`, 'Float64 amplitude buffer only'], ['EXACT REFERENCE', run.problem.reference.toFixed(4), run.problem.unit]];
    $('circuitMetrics').replaceChildren(...metrics.map(([name, value, caption]) => {
      const node = document.createElement('div'); node.className = 'circuit-metric';
      node.innerHTML = `<span>${name}</span><strong>${value}</strong><small>${caption}</small>`; return node;
    }));
    const text = run.problem.terms.length ? run.problem.terms.map(([word, coefficient]) => `${coefficient >= 0 ? '+' : '−'} ${Math.abs(coefficient).toFixed(6)} ${word}`).join(' ') : run.config.problem === 'maxcut' ? 'H = −Σ(i,j)∈edges (I − ZiZj) / 2 · unweighted ring' : 'C(x) = Σi (0.06 + 0.01i − return[i])xi + 0.025 Σi<j xixj + 0.5(Σi xi − 2)²';
    $('hamiltonian').textContent = text;
    if (run.config.problem === 'portfolio') {
      const detail = document.createElement('div');
      detail.textContent = 'Returns: [0.12, 0.18, 0.10, 0.15, 0.09, 0.16], truncated to n assets.';
      $('hamiltonian').append(detail);
    }
    const ref = document.createElement('span'); ref.className = 'reference'; ref.textContent = `E₀ = ${run.problem.reference.toFixed(9)} ${run.problem.unit}`; $('hamiltonian').append(ref);
  }
  async function compare() {
    if (busy) { cancelWork(); setStatus('Paused'); updateButton(); }
    const token = ++comparisonToken;
    comparison = VQE.OPTIMIZERS.map(optimizer => VQE.createRun({ ...run.config, optimizer }));
    $('compareBtn').disabled = true; $('compareBtn').textContent = 'Comparing…';
    while (comparison[0].iteration < run.config.iterations && token === comparisonToken) {
      // Yield regularly so reset, configuration changes, and navigation remain responsive.
      const start = performance.now();
      do { comparison.forEach(r => r.step()); } while (performance.now() - start < 12 && comparison[0].iteration < run.config.iterations);
      if (activeView === 'experiments') renderView();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (token !== comparisonToken) return;
    const colors = VQECharts.palette();
    $('comparisonRows').replaceChildren(...comparison.map((r, i) => {
      const tr = document.createElement('tr');
      [r.config.optimizer, r.best.toFixed(6), Math.max(0, r.best - r.problem.reference).toExponential(3), r.evaluations, r.iteration].forEach((value, col) => {
        const td = document.createElement('td'); td.textContent = value;
        if (col === 0) td.style.color = [colors.accent, colors.violet, colors.green][i]; tr.append(td);
      }); return tr;
    }));
    $('compareBtn').disabled = false; $('compareBtn').textContent = 'Run comparison ↗'; notice('Comparison complete. All optimizers used the same initial angles.');
  }
  function download(content, extension, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const link = document.createElement('a'); link.href = url; link.download = `vqe-${run.config.problem}-seed${run.config.seed}.${extension}`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportJSON() { download(JSON.stringify(run.snapshot(), null, 2), 'json', 'application/json'); }
  function exportCSV() {
    const header = ['iteration', 'energy', 'best_energy', 'exact_gap', ...run.parameters.map((_, i) => `theta_${i}`)];
    const rows = run.history.map(r => [r.iteration, r.energy, r.best, r.best - run.problem.reference, ...r.parameters].join(','));
    download([header.join(','), ...rows].join('\n') + '\n', 'csv', 'text/csv');
  }
  async function replay(config, count, label) {
    VQE.validateConfig(config);
    if (!Number.isInteger(count) || count < 0 || count > config.iterations) throw new Error('Invalid replay length.');
    reset(config, 'Replaying…');
    const token = comparisonToken;
    $('runBtn').disabled = true;
    $('mobileRunBtn').disabled = true;
    try {
      while (run.iteration < count && token === comparisonToken) {
        const start = performance.now();
        do { const t = performance.now(); run.step(); computeMs += performance.now() - t; } while (performance.now() - start < 12 && run.iteration < count);
        update(); await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (token === comparisonToken) { setStatus(label); update(); }
    } finally { $('runBtn').disabled = false; $('mobileRunBtn').disabled = false; }
  }
  function persistNotebook() {
    try { localStorage.setItem('vqe-notebook-v1', JSON.stringify(saved)); return true; }
    catch { notice('Browser storage is unavailable. This notebook is kept in memory; export JSON to keep your run.'); return false; }
  }
  function renderNotebook() {
    if (!saved.length) { $('savedRuns').innerHTML = '<div class="empty-notebook">Your next discovery belongs here.<br>Save a run to compare or replay it later.</div>'; return; }
    $('savedRuns').replaceChildren(...saved.map((entry, i) => {
      const row = document.createElement('div'); row.className = 'saved-row';
      const info = document.createElement('div'); info.className = 'saved-info';
      const title = document.createElement('strong'); title.textContent = `${VQE.PROBLEMS.find(p => p.id === entry.config.problem).short} · ${entry.config.optimizer}`;
      const detail = document.createElement('small'); detail.textContent = `${entry.config.qubits}q / ${entry.config.layers}L · seed ${entry.config.seed} · ${entry.iteration} iterations`;
      info.append(title, detail);
      const energy = document.createElement('span'); energy.className = 'saved-energy'; energy.textContent = entry.best.toFixed(5);
      const restore = document.createElement('button'); restore.className = 'button small'; restore.textContent = 'Replay';
      restore.addEventListener('click', () => { switchView('overview'); replay(entry.config, entry.iteration, 'Replayed run').catch(e => notice(e.message)); });
      const remove = document.createElement('button'); remove.className = 'icon-button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove saved run ${i + 1}`);
      remove.addEventListener('click', () => { saved.splice(i, 1); persistNotebook(); renderNotebook(); });
      row.append(info, energy, restore, remove); return row;
    }));
  }
  function init() {
    try {
      document.documentElement.dataset.theme = localStorage.getItem('vqe-theme') === 'light' ? 'light' : 'dark';
      const data = JSON.parse(localStorage.getItem('vqe-notebook-v1') || '[]');
      if (Array.isArray(data)) saved = data.slice(0, 8).filter(entry => {
        try { VQE.validateConfig(entry.config); return Number.isFinite(entry.best) && Number.isInteger(entry.iteration) && entry.iteration >= 0 && entry.iteration <= entry.config.iterations; } catch { return false; }
      });
    } catch { /* Storage is optional; the simulator also works from file://. */ }
    $('themeBtn').setAttribute('aria-label', `Switch to ${document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'} theme`);
    example(); renderNotebook();
    configControls.forEach(id => $(id).addEventListener(id === 'seed' ? 'change' : 'input', () => {
      try {
        if (id === 'problemSelect') {
          const meta = VQE.PROBLEMS.find(p => p.id === $('problemSelect').value);
          $('qubits').value = meta.qubits; $('layers').value = meta.layers;
        }
        reset(readConfig());
      } catch (error) { cancelWork(); setStatus('Invalid setup'); updateButton(); notice(error.message); }
    }));
    $('runBtn').addEventListener('click', toggleRun);
    $('mobileRunBtn').addEventListener('click', toggleRun);
    $('mobileSetupBtn').addEventListener('click', () => $('setup').scrollIntoView({ block: 'start' }));
    $('resetBtn').addEventListener('click', () => { try { reset(); } catch (e) { notice(e.message); } });
    $('exampleBtn').addEventListener('click', example);
    document.querySelectorAll('[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => switchView(tab.dataset.tab));
      tab.addEventListener('keydown', e => {
        const tabs = [...document.querySelectorAll('[data-tab]')], current = tabs.indexOf(tab);
        let next;
        if (['ArrowDown', 'ArrowRight'].includes(e.key)) next = (current + 1) % tabs.length;
        if (['ArrowUp', 'ArrowLeft'].includes(e.key)) next = (current - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home') next = 0; if (e.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { e.preventDefault(); switchView(tabs[next].dataset.tab, true); }
      });
    });
    document.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.open, true)));
    for (const id of ['sliceX', 'sliceY']) $(id).addEventListener('change', () => {
      if ($('sliceX').value === $('sliceY').value) {
        const other = id === 'sliceX' ? 'sliceY' : 'sliceX';
        $(other).value = (Number($(id).value) + 1) % run.parameters.length;
      }
      landscapeData = null; renderView();
    });
    $('themeBtn').addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = theme;
      $('themeBtn').setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
      try { localStorage.setItem('vqe-theme', theme); } catch { /* Optional preference. */ }
      renderView(); renderCircuit();
    });
    $('aboutBtn').addEventListener('click', () => $('aboutDialog').showModal());
    $('footerAboutBtn').addEventListener('click', () => $('aboutDialog').showModal());
    document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => $(btn.dataset.close).close()));
    $('showDataBtn').addEventListener('click', () => {
      $('traceRows').replaceChildren(...run.history.map(row => {
        const tr = document.createElement('tr');
        [row.iteration, row.energy.toFixed(8), row.best.toFixed(8), (row.best - run.problem.reference).toExponential(4)].forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.append(td); }); return tr;
      })); $('dataDialog').showModal();
    });
    $('exportJsonBtn').addEventListener('click', exportJSON); $('exportCsvBtn').addEventListener('click', exportCSV);
    $('importBtn').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        if (file.size > 1000000) throw new Error('Run files must be smaller than 1 MB.');
        const data = JSON.parse(await file.text());
        if (data.schemaVersion !== 1 || data.engine !== 'real-statevector-ry-cnot-v1' || !Array.isArray(data.history)) throw new Error('Unsupported run format. Export JSON from this workbench.');
        VQE.validateConfig(data.config);
        await replay(data.config, data.history.length - 1, 'Imported · recomputed');
        notice('Imported setup replayed. Energies were recomputed locally.');
      } catch (error) { notice(error instanceof SyntaxError ? 'Invalid JSON file.' : error.message); }
      finally { e.target.value = ''; }
    });
    $('compareBtn').addEventListener('click', compare);
    $('saveRunBtn').addEventListener('click', () => {
      saved.unshift({ config: { ...run.config }, iteration: run.iteration, best: run.best }); saved = saved.slice(0, 8);
      const persisted = persistNotebook(); renderNotebook();
      if (persisted) notice('Run saved in your browser notebook.');
    });
    $('shareBtn').addEventListener('click', async () => {
      const url = new URL(location.href); url.search = '';
      Object.entries(run.config).forEach(([key, value]) => url.searchParams.set(key, value)); url.searchParams.set('step', run.iteration);
      try { await navigator.clipboard.writeText(url.href); notice('Reproducible setup link copied.'); }
      catch { history.replaceState(null, '', url.href); notice('Setup encoded in the address bar. Copy its URL to share.'); }
    });
    $('energyChart').addEventListener('pointermove', e => {
      const rect = e.currentTarget.getBoundingClientRect();
      const index = Math.round((e.clientX - rect.left - 60) / (rect.width - 78) * run.config.iterations);
      if (index < 0 || index >= run.history.length) { $('energyTooltip').hidden = true; return; }
      const row = run.history[index]; $('energyTooltip').textContent = `Iteration ${index} · ${row.energy.toFixed(6)} ${run.problem.unit}`; $('energyTooltip').hidden = false;
    });
    $('energyChart').addEventListener('pointerleave', () => { $('energyTooltip').hidden = true; });
    const resize = () => { document.querySelector('[role="tablist"]').setAttribute('aria-orientation', matchMedia('(max-width:540px)').matches ? 'horizontal' : 'vertical'); cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(renderView); };
    new ResizeObserver(resize).observe(document.querySelector('.analysis-area'));
    window.addEventListener('resize', resize);
    document.addEventListener('keydown', e => {
      if (e.target.closest('input,select,button,a,dialog') || document.querySelector('dialog[open]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space') { e.preventDefault(); toggleRun(); }
      if (e.key.toLowerCase() === 'r') { try { reset(); } catch (error) { notice(error.message); } }
    });
    const query = new URLSearchParams(location.search);
    if (query.has('problem')) {
      try {
        const config = { ...defaults };
        for (const key of Object.keys(config)) if (query.has(key)) config[key] = typeof config[key] === 'number' ? Number(query.get(key)) : query.get(key);
        const count = Number(query.get('step') || 0);
        VQE.validateConfig(config);
        replay(config, count, 'Shared setup').catch(e => notice(e.message));
      } catch (error) { notice(`Invalid shared setup: ${error.message}`); }
    }
  }
  init();
})();
