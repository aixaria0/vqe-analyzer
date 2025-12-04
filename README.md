# VQE Optimization Analyzer
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-active-success.svg)]()

## Overview
**A High-Performance Interactive Data Visualization Engine.**
This tool renders complex algorithmic performance landscapes in real-time using zero-dependency Vanilla JavaScript. While built for Quantum VQE, the underlying engine is production-ready for financial and industrial applications.

https://aixaria0.github.io/vqe-analyzer/

## 🚀 Industrial Use Cases
* **Fintech & Trading:** Visualizing real-time portfolio risk landscapes (Markowitz Optimization).
* **Machine Learning Ops:** Tracking Neural Network Loss Function convergence in 3D.
* **Supply Chain:** Cost-surface optimization for logistics networks.
* **Zero-Dependency:** Built in high-performance Vanilla JS (No React/NPM bloat).

## Features
* **Multiple Use Cases:** Explore VQE, QAOA, and Financial Portfolio Optimization.
* **Optimizer Comparison:** Test Adam, COBYLA, and Gradient Descent in real-time.
* **Interactive Visualizations:** 2D loss landscape exploration and convergence tracking.
.

## Features

- **Multiple Use Cases**: Explore VQE applications in:
  - Quantum Chemistry (H₂ molecule)
  - QAOA for Graph MaxCut problems
  - NISQ Ising Model simulations
  - Quantum Machine Learning classifiers
  - Financial Portfolio Optimization
  - Adaptive VQE with auto-growing circuits

- **Optimizer Comparison**: Test different optimization algorithms:
  - Adam optimizer
  - COBYLA (Constrained Optimization BY Linear Approximation)
  - Gradient Descent

- **Interactive Visualizations**:
  - Real-time cost function convergence tracking
  - 2D loss landscape exploration
  - Circuit statistics and gate count analysis
  - Parameter evolution monitoring
  - Performance metrics dashboard

- **Customizable Parameters**:
  - Adjustable learning rates
  - Configurable iteration limits
  - Dynamic circuit architecture (qubits and layers)

## Getting Started

### Prerequisites

This is a pure frontend application requiring only a modern web browser with JavaScript enabled.

### Installation

1. Clone the repository:
```bash
git clone https://github.com/aixaria0/vqe-analyzer.git
cd vqe-analyzer
```

2. Open `index.html` in your web browser:
```bash
# On macOS
open index.html

# On Linux
xdg-open index.html

# On Windows
start index.html
```

Alternatively, serve it using a local web server:
```bash
# Using Python 3
python3 -m http.server 8000

# Using Node.js http-server
npx http-server
```

Then navigate to `http://localhost:8000` in your browser.

## Usage

1. **Select a Use Case**: Choose from the dropdown menu to explore different quantum computing applications
2. **Configure Optimizer**: Select your preferred optimization algorithm
3. **Adjust Parameters**: Use the sliders to set learning rate and maximum iterations
4. **Run Simulation**: Click "Play" to start the optimization process
5. **Explore Tabs**: Navigate through different visualization tabs to analyze the results

## Project Structure

```
vqe-analyzer/
├── index.html      # Main HTML structure
├── style.css       # Styling and layout
├── app.js          # Core application logic and simulations
└── README.md       # This file
```

## Technology Stack

- **HTML5**: Semantic markup
- **CSS3**: Modern styling with CSS variables and grid layout
- **JavaScript (ES6+)**: Vanilla JS for logic and interactivity
- **Chart.js**: Data visualization library

## Contributing

Contributions are welcome! If you'd like to improve this project:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support This Project

This project is **free and open source**. If you find it helpful, you can support me by **buying me a tea** ☕ or following me on **[LinkedIn](https://www.linkedin.com/in/ariafani)**.

Your support helps maintain and improve this tool, add new features, and create more educational quantum computing resources.

## ⚡ Web3 Sponsorship
Due to international banking restrictions, this open-source project is funded exclusively via decentralized finance.
**Support Development:**
* **USDT/USDC (TRC20):** `[TKGv7Jap7hE5DVtaDYBQWqXQjcdW61NRT6]`
* **ETH/USDT (ERC20):** `[0x774D95E2F263c56bE908E878B866D675df9282A4]`
* **TON:** `[UQAdHM0Sd008XSW6B4xPfd2uU07zZratOVrerD6subpxgyNK]`

*Invoices for commercial integration available in USDC/USDT.*


```

Every contribution, no matter how small, is greatly appreciated! 💙

## License

This project is licensed under the MIT License - see below for details:

```
MIT License

Copyright (c) 2025 Aria Fani (AIXARIA)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Acknowledgments

- Built with passion for quantum computing education
- Inspired by the quantum computing research community
- Created by **Aria Fani**

## Contact

For questions or suggestions, please open an issue on GitHub. For collaboration opportunities or professional inquiries, feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/ariafani).

---

**Made with ❤️ by Aria Fani for the quantum computing community**