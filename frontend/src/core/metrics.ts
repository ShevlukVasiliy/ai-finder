/** ROC-AUC via the Mann–Whitney statistic (ties count half). */
export function rocAuc(scores: number[], labels: boolean[]): number {
  const pos = scores.filter((_, i) => labels[i]);
  const neg = scores.filter((_, i) => !labels[i]);
  if (!pos.length || !neg.length) return 0.5;
  let acc = 0;
  for (const p of pos) for (const n of neg) acc += p > n ? 1 : p === n ? 0.5 : 0;
  return acc / (pos.length * neg.length);
}

export function fpr(scores: number[], labels: boolean[], threshold: number): number {
  const neg = scores.filter((_, i) => !labels[i]);
  return neg.length ? neg.filter((s) => s >= threshold).length / neg.length : 0;
}

export function f1(scores: number[], labels: boolean[], threshold: number): number {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  scores.forEach((s, i) => {
    const p = s >= threshold;
    if (p && labels[i]) tp++;
    else if (p) fp++;
    else if (labels[i]) fn++;
  });
  return tp ? (2 * tp) / (2 * tp + fp + fn) : 0;
}

/**
 * L2-regularised logistic regression with non-negative weights (projected gradient descent).
 * Non-negativity keeps every detector's contribution interpretable as "more of this → more AI-like".
 */
export function fitLogistic(
  X: number[][],
  y: number[],
  opts: { l2?: number; lr?: number; epochs?: number; sampleWeights?: number[] } = {},
): { bias: number; weights: number[] } {
  const { l2 = 0.02, lr = 0.5, epochs = 4000, sampleWeights } = opts;
  const sw = sampleWeights ?? X.map(() => 1);
  const total = sw.reduce((a, b) => a + b, 0) || 1;
  const d = X[0]?.length ?? 0;
  const w = new Array<number>(d).fill(0.5);
  let b = 0;
  const n = X.length;
  for (let e = 0; e < epochs; e++) {
    const gw = new Array<number>(d).fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const xi = X[i]!;
      let z = b;
      for (let j = 0; j < d; j++) z += w[j]! * xi[j]!;
      const err = (1 / (1 + Math.exp(-z)) - y[i]!) * sw[i]!;
      gb += err;
      for (let j = 0; j < d; j++) gw[j]! += err * xi[j]!;
    }
    b -= (lr * gb) / total;
    for (let j = 0; j < d; j++) w[j] = Math.max(0, w[j]! - lr * (gw[j]! / total + l2 * w[j]!));
  }
  return { bias: b, weights: w };
}
