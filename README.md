# VQE Optimization Analyzer

https://aixaria0.github.io/vqe-analyzer/

An interactive **Variational Quantum Eigensolver (VQE)** analysis tool for visualizing quantum optimization algorithms in real-time.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

## About the Author

**Aria Fani** is a researcher and developer with a passion for quantum computing and artificial intelligence. With a background in AI security and bioinformatics, Aria is dedicated to creating open-source tools that make complex technologies accessible to a broader audience.

Connect with Aria on [LinkedIn](https://www.linkedin.com/in/ariafani).

## Overview

The VQE Optimization Analyzer is a web-based interactive tool designed to help researchers, students, and quantum computing enthusiasts understand and visualize the behavior of Variational Quantum[...] 

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

### Cryptocurrency Donations

**Bitcoin (BTC)**:
```
bc1qel4tqp70my0cg07tn9q4k7q49gnf576j3zxqs6
```

**Ethereum (ETH)**:
```
0x774D95E2F263c56bE908E878B866D675df9282A4
```

**TON**:
```
UQAdHM0Sd008XSW6B4xPfd2uU07zZratOVrerD6subpxgyNK
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