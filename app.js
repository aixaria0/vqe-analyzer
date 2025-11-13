/* global Chart */

// Use Cases Data
const useCases = [
  {
    name: "Chemistry H₂",
    displayName: "Quantum Chemistry - Hydrogen",
    qubits: 4,
    layers: 3,
    parameters: 12,
    recommendedOptimizer: "Adam",
    expectedIterations: 100,
    expectedFinalCost: -1.137,
    hamiltonianDescription: "Molecular H₂ ground state"
  },
  {
    name: "QAOA MaxCut",
    displayName: "QAOA - Graph MaxCut",
    qubits: 4,
    layers: 2,
    parameters: 8,
    recommendedOptimizer: "Gradient Descent",
    expectedIterations: 50,
    expectedFinalCost: 3.8,
    hamiltonianDescription: "4-node square graph MaxCut"
  },
  {
    name: "NISQ Ising",
    displayName: "NISQ - Ising Model",
    qubits: 6,
    layers: 2,
    parameters: 12,
    recommendedOptimizer: "COBYLA",
    expectedIterations: 150,
    expectedFinalCost: -4.2,
    hamiltonianDescription: "Transverse-field Ising"
  },
  {
    name: "ML Classifier",
    displayName: "QML - Binary Classifier",
    qubits: 4,
    layers: 2,
    parameters: 8,
    recommendedOptimizer: "Adam",
    expectedIterations: 50,
    expectedFinalCost: 0.15,
    hamiltonianDescription: "Data classification"
  },
  {
    name: "Portfolio",
    displayName: "Finance - Portfolio Optimization",
    qubits: 4,
    layers: 1,
    parameters: 8,
    recommendedOptimizer: "COBYLA",
    expectedIterations: 100,
    expectedFinalCost: 0.32,
    hamiltonianDescription: "4-asset portfolio"
  },
  {
    name: "Adaptive VQE",
    displayName: "Adaptive VQE - Auto-Grow",
    qubits: 4,
    layers: 3,
    parameters: 12,
    recommendedOptimizer: "Adam",
    expectedIterations: 60,
    expectedFinalCost: -3.9,
    hamiltonianDescription: "Adaptive ansatz"
  },
  {
    name: "Quantum Gem",
    displayName: "Quantum Gem - Hybrid Prompt Defense",
    qubits: 6,
    layers: 3,
    parameters: 18,
    recommendedOptimizer: "Adam",
    expectedIterations: 120,
    expectedFinalCost: -2.8,
    hamiltonianDescription: "Hybrid quantum-classical prompt injection detection demo"
  }
];

const optimizers = [
  { name: "Adam", learningRate: 0.1, momentum: 0.9, description: "Adaptive gradient-based optimizer" },
  { name: "COBYLA", tolerance: 0.0001, description: "Gradient-free, noise-robust" },
  { name: "Gradient Descent", learningRate: 0.05, description: "Standard gradient descent" }
];

// State Management
let state = {
  currentUseCase: 0,
  currentOptimizer: 0,
  learningRate: 0.1,
  maxIterations: 100,
  currentIteration: 0,
  isRunning: false,
  costHistory: [],
  parameters: [],
  parameterHistory: [],
  bestCost: 0,
  currentCost: 0,
  qubits: 4,
  layers: 3,
  trajectory: []
};

// Chart instances
let costChart = null;
let gateChart = null;
let radarChart = null;
let paramDistChart = null;
let landscapeCtx = null;
let animationFrame = null;

// Initialize application
function init() {
  setupEventListeners();
  initializeCharts();
  loadUseCase(0);
  updateCircuitStats();
  renderLandscape();
  renderSensitivityHeatmap();
  renderParameterHistory();
}

// Event Listeners
function setupEventListeners() {
  document.getElementById('useCaseSelect').addEventListener('change', (e) => {
    loadUseCase(parseInt(e.target.value));
  });
  
  document.getElementById('optimizerSelect').addEventListener('change', (e) => {
    state.currentOptimizer = parseInt(e.target.value);
  });
  
  document.getElementById('learningRate').addEventListener('input', (e) => {
    state.learningRate = parseFloat(e.target.value);
    document.getElementById('learningRateValue').textContent = state.learningRate.toFixed(2);
  });
  
  document.getElementById('maxIterations').addEventListener('input', (e) => {
    state.maxIterations = parseInt(e.target.value);
    document.getElementById('maxIterValue').textContent = state.maxIterations;
  });
  
  document.getElementById('playBtn').addEventListener('click', startOptimization);
  document.getElementById('pauseBtn').addEventListener('click', pauseOptimization);
  document.getElementById('resetBtn').addEventListener('click', resetOptimization);
  
  document.getElementById('qubitSlider').addEventListener('input', (e) => {
    state.qubits = parseInt(e.target.value);
    document.getElementById('qubitValue').textContent = state.qubits;
    updateCircuitStats();
  });
  
  document.getElementById('layerSlider').addEventListener('input', (e) => {
    state.layers = parseInt(e.target.value);
    document.getElementById('layerValue').textContent = state.layers;
    updateCircuitStats();
  });
  
  document.getElementById('sliceSelector').addEventListener('input', (e) => {
    const idx = parseInt(e.target.value);
    document.getElementById('sliceIndex').textContent = idx;
    document.getElementById('sliceIndex2').textContent = idx + 1;
    renderLandscape();
  });
  
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      switchTab(tabName);
    });
  });
}

// Tab Switching
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(tabName).classList.add('active');
  
  // Refresh charts when switching tabs
  if (tabName === 'landscape') {
    renderLandscape();
  } else if (tabName === 'parameters') {
    if (radarChart) radarChart.update();
  }
}

// Load Use Case
function loadUseCase(index) {
  state.currentUseCase = index;
  const useCase = useCases[index];
  
  state.qubits = useCase.qubits;
  state.layers = useCase.layers;
  state.maxIterations = useCase.expectedIterations;
  
  document.getElementById('qubitCount').textContent = useCase.qubits;
  document.getElementById('layerCount').textContent = useCase.layers;
  document.getElementById('paramCount').textContent = useCase.parameters;
  document.getElementById('hamiltonianDesc').textContent = useCase.hamiltonianDescription;
  document.getElementById('maxIterValue').textContent = useCase.expectedIterations;
  document.getElementById('maxIterations').value = useCase.expectedIterations;
  
  document.getElementById('qubitSlider').value = useCase.qubits;
  document.getElementById('layerSlider').value = useCase.layers;
  document.getElementById('qubitValue').textContent = useCase.qubits;
  document.getElementById('layerValue').textContent = useCase.layers;
  
  resetOptimization();
  updateCircuitStats();
}

// Initialize Charts
function initializeCharts() {
  // Cost Chart
  const costCtx = document.getElementById('costChart').getContext('2d');
  costChart = new Chart(costCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Cost Function',
        data: [],
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Iteration', color: '#777' },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        y: {
          title: { display: true, text: 'Cost', color: '#777' },
          grid: { color: 'rgba(0,0,0,0.05)' }
        }
      },
      animation: { duration: 0 }
    }
  });
  
  // Gate Chart
  const gateCtx = document.getElementById('gateChart').getContext('2d');
  gateChart = new Chart(gateCtx, {
    type: 'bar',
    data: {
      labels: ['RY Gates', 'RZ Gates', 'CNOT Gates', 'Hadamard'],
      datasets: [{
        label: 'Gate Count',
        data: [12, 6, 8, 2],
        backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C', '#5D878F']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Count' } }
      }
    }
  });
  
  // Radar Chart
  const radarCtx = document.getElementById('radarChart').getContext('2d');
  radarChart = new Chart(radarCtx, {
    type: 'radar',
    data: {
      labels: [],
      datasets: [{
        label: 'Parameters',
        data: [],
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124, 58, 237, 0.2)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          max: Math.PI * 2
        }
      }
    }
  });
  
  // Noise Chart
  const noiseCtx = document.getElementById('noiseChart').getContext('2d');
  new Chart(noiseCtx, {
    type: 'line',
    data: {
      labels: ['0%', '1%', '2%', '3%', '4%', '5%'],
      datasets: [{
        label: 'Cost with Noise',
        data: [0.012, 0.018, 0.031, 0.052, 0.089, 0.143],
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true }
      },
      scales: {
        x: { title: { display: true, text: 'Noise Level' } },
        y: { title: { display: true, text: 'Final Error' }, beginAtZero: true }
      }
    }
  });
  
  // Parameter Distribution Chart
  const paramDistCtx = document.getElementById('paramDistChart').getContext('2d');
  paramDistChart = new Chart(paramDistCtx, {
    type: 'doughnut',
    data: {
      labels: ['Layer 1', 'Layer 2', 'Layer 3'],
      datasets: [{
        data: [4, 4, 4],
        backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
  
  // Landscape Canvas
  landscapeCtx = document.getElementById('landscapeCanvas').getContext('2d');
}

// Optimization Functions
function startOptimization() {
  if (state.isRunning) return;
  state.isRunning = true;
  runOptimizationStep();
}

function pauseOptimization() {
  state.isRunning = false;
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }
}

function resetOptimization() {
  pauseOptimization();
  state.currentIteration = 0;
  state.costHistory = [];
  state.parameterHistory = [];
  state.trajectory = [];
  
  const useCase = useCases[state.currentUseCase];
  state.currentCost = Math.abs(useCase.expectedFinalCost) * 5;
  state.bestCost = state.currentCost;
  
  // Initialize random parameters
  state.parameters = Array(useCase.parameters).fill(0).map(() => Math.random() * 2 * Math.PI);
  
  updateDashboard();
  
  costChart.data.labels = [];
  costChart.data.datasets[0].data = [];
  costChart.update();
  
  updateRadarChart();
  renderLandscape();
}

function runOptimizationStep() {
  if (!state.isRunning || state.currentIteration >= state.maxIterations) {
    state.isRunning = false;
    return;
  }
  
  const useCase = useCases[state.currentUseCase];
  const targetCost = useCase.expectedFinalCost;
  
  // Simulate convergence with noise
  const optimizer = optimizers[state.currentOptimizer];
  let convergenceRate = 0.90; // Default for COBYLA/GD-like behavior
  
  if (optimizer.name === 'Adam') {
    convergenceRate = 0.96; // Adam is typically faster
} else if (optimizer.name === 'COBYLA') {
    convergenceRate = 0.90;
  } else if (optimizer.name === 'Gradient Descent') {
    convergenceRate = 0.92;
  }
  
  let noiseFactor = 0.1;
  if (optimizer.name === 'Adam') {
    noiseFactor = 0.05; // Adam is typically more stable
  }
  const noise = (Math.random() - 0.5) * noiseFactor * Math.abs(targetCost);
  const idealCost = state.currentCost + (targetCost - state.currentCost) * (1 - Math.pow(convergenceRate, state.currentIteration + 1));
  state.currentCost = idealCost + noise;
  
  if (state.currentCost < state.bestCost) {
    state.bestCost = state.currentCost;
  }
  
  state.costHistory.push(state.currentCost);
  
  // Update parameters
  state.parameters = state.parameters.map((p) => {
    const gradient = (Math.random() - 0.5) * state.learningRate;
    return (p + gradient) % (2 * Math.PI);
  });
  state.parameterHistory.push([...state.parameters]);
  
  // Add to trajectory
  if (state.parameters.length >= 2) {
    state.trajectory.push([state.parameters[0], state.parameters[1]]);
  }
  
  state.currentIteration++;
  
  updateDashboard();
  updateCostChart();
  updateRadarChart();
  
  if (state.currentIteration % 5 === 0) {
    renderLandscape();
  }
  
  animationFrame = requestAnimationFrame(() => {
    setTimeout(runOptimizationStep, 50);
  });
}

// Update Functions
function updateDashboard() {
  document.getElementById('currentCost').textContent = state.currentCost.toFixed(3);
  document.getElementById('bestCost').textContent = state.bestCost.toFixed(3);
  document.getElementById('iteration').textContent = state.currentIteration;
  
  const convergenceRate = state.currentIteration > 0 
    ? Math.min(100, (1 - Math.abs(state.bestCost - useCases[state.currentUseCase].expectedFinalCost) / Math.abs(useCases[state.currentUseCase].expectedFinalCost)) * 100)
    : 0;
  document.getElementById('convergenceRate').textContent = convergenceRate.toFixed(0) + '%';
}

function updateCostChart() {
  costChart.data.labels = Array(state.costHistory.length).fill(0).map((_, i) => i);
  costChart.data.datasets[0].data = state.costHistory;
  costChart.update('none');
}

function updateRadarChart() {
  if (state.parameters.length === 0) return;
  
  radarChart.data.labels = state.parameters.map((_, i) => `θ${i}`);
  radarChart.data.datasets[0].data = state.parameters;
  radarChart.update();
}

function updateCircuitStats() {
  const ryGates = state.qubits * state.layers;
  const rzGates = Math.floor(state.qubits * state.layers / 2);
  const cnotGates = (state.qubits - 1) * state.layers;
  const hadamard = state.qubits;
  const totalGates = ryGates + rzGates + cnotGates + hadamard;
  
  document.getElementById('totalGates').textContent = totalGates;
  document.getElementById('circuitDepth').textContent = state.layers * 4 + 2;
  document.getElementById('totalParams').textContent = ryGates + rzGates;
  document.getElementById('execTime').textContent = (totalGates * 0.1).toFixed(1) + ' ms';
  document.getElementById('memoryReq').textContent = Math.pow(2, state.qubits) * 16 + ' KB';
  
  gateChart.data.datasets[0].data = [ryGates, rzGates, cnotGates, hadamard];
  gateChart.update();
  
  // Update parameter distribution
  const labels = [];
  const data = [];
  for (let i = 0; i < state.layers; i++) {
    labels.push(`Layer ${i + 1}`);
    data.push(Math.floor((ryGates + rzGates) / state.layers));
  }
  paramDistChart.data.labels = labels;
  paramDistChart.data.datasets[0].data = data;
  paramDistChart.update();
}

// Landscape Rendering
function renderLandscape() {
  const canvas = document.getElementById('landscapeCanvas');
  const ctx = landscapeCtx;
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = canvas.offsetHeight;
  
  // Draw heatmap
  const resolution = 50;
  const cellWidth = width / resolution;
  const cellHeight = height / resolution;
  
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const x = i / resolution * 2 * Math.PI;
      const y = j / resolution * 2 * Math.PI;
      
      // Simulate loss landscape
      const cost = simulateCost(x, y);
      const useCase = useCases[state.currentUseCase];
      const maxCost = Math.abs(useCase.expectedFinalCost) * 5;
      const minCost = useCase.expectedFinalCost;
      
      const normalized = (cost - minCost) / (maxCost - minCost);
      const hue = (1 - normalized) * 240; // Blue to red
      
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      ctx.fillRect(i * cellWidth, j * cellHeight, cellWidth, cellHeight);
    }
  }
  
  // Draw trajectory
  if (state.trajectory.length > 1) {
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    state.trajectory.forEach((point, idx) => {
      const x = (point[0] / (2 * Math.PI)) * width;
      const y = (point[1] / (2 * Math.PI)) * height;
      
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Draw current position
    const last = state.trajectory[state.trajectory.length - 1];
    const lastX = (last[0] / (2 * Math.PI)) * width;
    const lastY = (last[1] / (2 * Math.PI)) * height;
    
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(lastX, lastY, 5, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function simulateCost(theta1, theta2) {
  const useCase = useCases[state.currentUseCase];
  const target = useCase.expectedFinalCost;
  
  // Create a landscape with local minima
  const cost1 = Math.sin(theta1) * Math.cos(theta2);
  const cost2 = Math.sin(theta1 * 2) * Math.sin(theta2 * 2) * 0.3;
  const cost3 = Math.cos(theta1 + theta2) * 0.2;
  
  return target + (cost1 + cost2 + cost3) * Math.abs(target) * 2;
}

// Sensitivity Heatmap
function renderSensitivityHeatmap() {
  const grid = document.getElementById('sensitivityGrid');
  grid.innerHTML = '';
  
  const paramCount = 12;
  const sensitivity = Array(paramCount).fill(0).map(() => Math.random());
  
  sensitivity.forEach((value, idx) => {
    const cell = document.createElement('div');
    cell.className = 'sensitivity-cell';
    const intensity = Math.floor(value * 255);
    cell.style.backgroundColor = `rgb(${255 - intensity}, ${100}, ${intensity})`;
    cell.textContent = `θ${idx}`;
    grid.appendChild(cell);
  });
}

// Parameter History
function renderParameterHistory() {
  const container = document.getElementById('paramHistoryGrid');
  container.innerHTML = '';
  
  const paramCount = useCases[state.currentUseCase].parameters;
  
  for (let i = 0; i < Math.min(paramCount, 12); i++) {
    const chartDiv = document.createElement('div');
    chartDiv.className = 'param-history-chart';
    
    const canvas = document.createElement('canvas');
    chartDiv.appendChild(canvas);
    container.appendChild(chartDiv);
    
    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: `θ${i}`,
          data: [],
          borderColor: '#7c3aed',
          borderWidth: 1,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' },
          title: { display: true, text: `Parameter θ${i}` }
        },
        scales: {
          x: { display: false },
          y: { display: true, min: 0, max: 2 * Math.PI }
        }
      }
    });
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);