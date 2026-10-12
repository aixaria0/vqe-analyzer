"""Independent NumPy reference for the browser's two-qubit H2 experiment.

No account, hardware access, or deprecated Qiskit primitives are required.
Electronic energy only: the nuclear-repulsion contribution is not included.
"""

import argparse
import json
from pathlib import Path

import numpy as np

I = np.eye(2)
X = np.array([[0.0, 1.0], [1.0, 0.0]])
Z = np.diag([1.0, -1.0])
H2 = (
    -1.052373245772859 * np.kron(I, I)
    + 0.39793742484318045 * np.kron(I, Z)
    - 0.39793742484318045 * np.kron(Z, I)
    - 0.01128010425623538 * np.kron(Z, Z)
    + 0.18093119978423156 * np.kron(X, X)
)


def seeded_random(seed):
    """Mulberry32, matching the browser's initial angles exactly."""
    value, mask = seed, 0xFFFFFFFF
    while True:
        value = (value + 0x6D2B79F5) & mask
        t = ((value ^ (value >> 15)) * (value | 1)) & mask
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & mask)) & mask
        yield ((t ^ (t >> 14)) & mask) / 4294967296


def statevector(parameters, layers=3):
    """RY on q0 and q1, then CX(0,1), repeated for each layer."""
    if len(parameters) != 2 * layers or not np.isfinite(parameters).all():
        raise ValueError("Invalid circuit parameters")
    state = np.array([1.0, 0.0, 0.0, 0.0])
    for layer in range(layers):
        for qubit in range(2):
            angle = parameters[layer * 2 + qubit]
            c, s = np.cos(angle / 2), np.sin(angle / 2)
            rotation = np.array([[c, -s], [s, c]])
            state = (np.kron(I, rotation) if qubit == 0 else np.kron(rotation, I)) @ state
        state[[1, 3]] = state[[3, 1]]
    return state


def energy(parameters, layers=3):
    state = statevector(parameters, layers)
    return float(state @ H2 @ state)


def run_vqe(seed=42, layers=3, iterations=100, learning_rate=0.08, optimizer="Adam"):
    if not isinstance(seed, int) or not 0 <= seed <= 0xFFFFFFFF:
        raise ValueError("Seed must be a 32-bit unsigned integer")
    if not isinstance(layers, int) or not 1 <= layers <= 5:
        raise ValueError("Layers must be between 1 and 5")
    if not isinstance(iterations, int) or not 20 <= iterations <= 300:
        raise ValueError("Iterations must be between 20 and 300")
    if not np.isfinite(learning_rate) or not 0.005 <= learning_rate <= 0.5:
        raise ValueError("Learning rate must be between 0.005 and 0.5")
    if optimizer not in ("Adam", "Gradient descent", "SPSA"):
        raise ValueError("Unknown optimizer")
    random = seeded_random(seed)
    parameters = np.array([next(random) * 2 * np.pi - np.pi for _ in range(2 * layers)])
    m, v = np.zeros_like(parameters), np.zeros_like(parameters)
    best = energy(parameters, layers)
    best_parameters, initial, evaluations = parameters.copy(), best, 1
    history = [{"iteration": 0, "energy": best, "best": best, "parameters": parameters.tolist()}]
    for iteration in range(1, iterations + 1):
        if optimizer == "SPSA":
            ck = 0.1 / iteration**0.101
            delta = np.array([-1 if next(random) < 0.5 else 1 for _ in parameters])
            difference = energy(parameters + ck * delta, layers) - energy(parameters - ck * delta, layers)
            gradient = difference / (2 * ck * delta)
            rate = learning_rate / iteration**0.602
            evaluations += 2
        else:
            gradient = np.zeros_like(parameters)
            for i in range(len(parameters)):
                plus, minus = parameters.copy(), parameters.copy()
                plus[i] += np.pi / 2
                minus[i] -= np.pi / 2
                gradient[i] = 0.5 * (energy(plus, layers) - energy(minus, layers))
            evaluations += 2 * len(parameters)
            rate = learning_rate
        if optimizer == "Adam":
            m = 0.9 * m + 0.1 * gradient
            v = 0.999 * v + 0.001 * gradient**2
            update = (m / (1 - 0.9**iteration)) / (np.sqrt(v / (1 - 0.999**iteration)) + 1e-8)
        else:
            update = gradient
        parameters -= rate * update
        current = energy(parameters, layers)
        evaluations += 1
        if current < best:
            best, best_parameters = current, parameters.copy()
        history.append({"iteration": iteration, "energy": current, "best": best, "parameters": parameters.tolist()})
    return {
        "schemaVersion": 1, "engine": "real-statevector-ry-cnot-v1",
        "config": {"problem": "h2", "qubits": 2, "layers": layers, "optimizer": optimizer,
                   "learningRate": learning_rate, "iterations": iterations, "seed": seed},
        "reference": float(np.linalg.eigvalsh(H2)[0]), "initial": initial, "best": best,
        "evaluations": evaluations, "bestParameters": best_parameters.tolist(), "history": history,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--layers", type=int, default=3)
    parser.add_argument("--iterations", type=int, default=100)
    parser.add_argument("--learning-rate", type=float, default=0.08)
    parser.add_argument("--optimizer", choices=["Adam", "Gradient descent", "SPSA"], default="Adam")
    parser.add_argument("--json", type=Path, help="Save a run that the browser can import and recompute")
    args = parser.parse_args()
    try:
        result = run_vqe(args.seed, args.layers, args.iterations, args.learning_rate, args.optimizer)
    except ValueError as error:
        parser.error(str(error))
    print(f"Best electronic energy: {result['best']:.9f} Ha")
    print(f"Exact reference:        {result['reference']:.9f} Ha")
    print(f"Gap to exact:           {result['best'] - result['reference']:.3e} Ha")
    print(f"Objective evaluations:  {result['evaluations']}")
    if args.json:
        args.json.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(f"Saved {args.json}")


if __name__ == "__main__":
    main()
