export class NumericSolverTool {
  findRoot(fn: (x: number) => number, initialGuess = 1, tolerance = 1e-7, maxIterations = 50) {
    let x = initialGuess;
    for (let i = 0; i < maxIterations; i++) {
      const y = fn(x);
      if (Math.abs(y) < tolerance) {
        return { success: true, root: x, iterations: i, residual: y };
      }
      const h = 1e-5;
      const derivative = (fn(x + h) - fn(x - h)) / (2 * h);
      if (Math.abs(derivative) < 1e-12) break;
      x -= y / derivative;
    }
    return { success: false, root: x, iterations: maxIterations, residual: fn(x) };
  }

  monteCarloMean(samples: number[]): { mean: number; count: number } {
    const mean = samples.reduce((sum, value) => sum + value, 0) / Math.max(samples.length, 1);
    return { mean, count: samples.length };
  }
}
