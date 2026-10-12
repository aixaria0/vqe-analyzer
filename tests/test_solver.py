import unittest
import numpy as np
from vqe_solver import H2, energy, run_vqe, statevector


class SolverTests(unittest.TestCase):
    def test_bell_state(self):
        state = statevector([np.pi / 2, 0], layers=1)
        np.testing.assert_allclose(state, [2**-0.5, 0, 0, 2**-0.5], atol=1e-12)
        self.assertAlmostEqual(float(state @ state), 1)

    def test_ground_state_and_reproducibility(self):
        run = run_vqe()
        self.assertEqual(run, run_vqe())
        self.assertLess(run['best'] - np.linalg.eigvalsh(H2)[0], 1e-5)
        self.assertEqual(run['evaluations'], 1301)
        self.assertAlmostEqual(energy(run['bestParameters']), run['best'])

    def test_invalid_settings(self):
        for setting in [{'seed': -1}, {'layers': 0}, {'iterations': 0}, {'learning_rate': float('nan')}, {'optimizer': 'unknown'}]:
            with self.assertRaises(ValueError):
                run_vqe(**setting)


if __name__ == '__main__':
    unittest.main()
