import type { PlayerModel } from "./model";

export type StrategyMode = "approx" | "exact";

export interface StrategyTables {
  N: number;
  mode: StrategyMode;
  stride: number;
  M: Float64Array;
  O: Float64Array;
  myDist: Float64Array;
  oppDist: Float64Array;
  myThreshold: number;
  oppThreshold: number;
  myModel: PlayerModel;
  oppModel: PlayerModel;
  solveMs: number;
}

export interface SolveProgress {
  percent: number;
  label: string;
}

export type ProgressFn = (progress: SolveProgress) => void;

const yieldToMain = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

export const THRESHOLD_CANDIDATES = [
  1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 30, 35, 40,
];

/**
 * Distribution of the final banked score (in 50-point units) for a player who
 * follows the policy "keep rolling until reaching B, then bank" and chooses the
 * hold that maximizes expected final score. D[0] is the bust probability.
 */
export function thresholdDistribution(
  model: PlayerModel,
  N: number,
  B: number,
): Float64Array {
  const S = model.stateCount;
  const V = new Float64Array(B * S);

  for (let p = B - 1; p >= 0; p -= 1) {
    const row = p * S;
    for (let state = 1; state < S; state += 1) {
      const outcomes = model.states[state];
      if (outcomes.probs.length === 0) continue;
      let expected = 0;
      for (let oi = 0; oi < outcomes.probs.length; oi += 1) {
        const start = outcomes.optionStart[oi];
        const end = outcomes.optionStart[oi + 1];
        let best = -1;
        for (let o = start; o < end; o += 1) {
          const q = p + outcomes.optionGain[o];
          const value = q >= B ? q : V[q * S + outcomes.optionNext[o]];
          if (value > best) best = value;
        }
        expected += outcomes.probs[oi] * (best >= 0 ? best : 0);
      }
      V[row + state] = expected;
    }
  }

  const D = new Float64Array(N + 1);
  const mass = new Float64Array(B * S);
  mass[model.fullState] = 1;

  for (let p = 0; p < B; p += 1) {
    const row = p * S;
    for (let state = 1; state < S; state += 1) {
      const mp = mass[row + state];
      if (mp <= 0) continue;
      const outcomes = model.states[state];
      for (let oi = 0; oi < outcomes.probs.length; oi += 1) {
        const start = outcomes.optionStart[oi];
        const end = outcomes.optionStart[oi + 1];
        let best = -1;
        let bestNext = 0;
        let bestGain = 0;
        for (let o = start; o < end; o += 1) {
          const q = p + outcomes.optionGain[o];
          const value = q >= B ? q : V[q * S + outcomes.optionNext[o]];
          if (value > best) {
            best = value;
            bestNext = outcomes.optionNext[o];
            bestGain = outcomes.optionGain[o];
          }
        }
        const add = mp * outcomes.probs[oi];
        if (best < 0) {
          D[0] += add;
          continue;
        }
        const q = p + bestGain;
        if (q >= B) {
          D[Math.min(q, N)] += add;
        } else {
          mass[q * S + bestNext] += add;
        }
      }
    }
  }

  let sum = 0;
  for (let s = 0; s <= N; s += 1) sum += D[s];
  if (sum > 0 && Math.abs(sum - 1) > 1e-10) {
    for (let s = 0; s <= N; s += 1) D[s] /= sum;
  }
  return D;
}

export function thresholdCandidates(N: number): number[] {
  const values = THRESHOLD_CANDIDATES.filter((value) => value <= N);
  if (!values.includes(N)) values.push(N);
  return [...new Set(values)].sort((a, b) => a - b);
}

export function chooseFixedThreshold(
  model: PlayerModel,
  N: number,
): { threshold: number; distribution: Float64Array } {
  const candidates = thresholdCandidates(N);
  let bestB = candidates[0] ?? 1;
  let bestD = thresholdDistribution(model, N, bestB);
  let bestMean = 0;
  for (let s = 0; s <= N; s += 1) bestMean += s * bestD[s];

  for (const B of candidates) {
    if (B === bestB) continue;
    const D = thresholdDistribution(model, N, B);
    let mean = 0;
    for (let s = 0; s <= N; s += 1) mean += s * D[s];
    if (mean > bestMean + 1e-12) {
      bestMean = mean;
      bestB = B;
      bestD = D;
    }
  }
  return { threshold: bestB, distribution: bestD };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Exact race DP for two fixed bank policies. This keeps the continuation value
 * monotone in both players' remaining scores, unlike a state-by-state "best
 * threshold" game which can cycle between incompatible pure strategies.
 */
export function solveFixedRace(
  myD: Float64Array,
  oppD: Float64Array,
  N: number,
): { M: Float64Array; O: Float64Array; stride: number } {
  const stride = N + 1;
  const size = stride * stride;
  const M = new Float64Array(size);
  const O = new Float64Array(size);
  for (let x = 0; x <= N; x += 1) {
    M[x] = 1;
    O[x] = 1;
  }

  const dm0 = myD[0];
  const do0 = oppD[0];
  const denominator = Math.max(1e-9, 1 - dm0 * do0);

  for (let total = 2; total <= 2 * N; total += 1) {
    const minA = Math.max(1, total - N);
    const maxA = Math.min(N, total - 1);
    for (let a = minA; a <= maxA; a += 1) {
      const b = total - a;
      let mp = 0;
      let op = 0;
      for (let s = 1; s < a; s += 1) {
        const p = myD[s];
        if (p > 0) mp += p * (1 - O[b * stride + (a - s)]);
        const q = oppD[s];
        if (q > 0) op += q * (1 - M[b * stride + (a - s)]);
      }
      for (let s = a; s <= N; s += 1) {
        mp += myD[s];
        op += oppD[s];
      }

      const m = clamp01((mp + dm0 * (1 - op - do0)) / denominator);
      const o = clamp01((op + do0 * (1 - mp - dm0)) / denominator);
      M[a * stride + b] = m;
      O[a * stride + b] = o;
    }
  }

  return { M, O, stride };
}

export function solveStrategySync(
  myModel: PlayerModel,
  oppModel: PlayerModel,
  N: number,
): StrategyTables {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const mine = chooseFixedThreshold(myModel, N);
  const theirs = chooseFixedThreshold(oppModel, N);
  const { M, O, stride } = solveFixedRace(mine.distribution, theirs.distribution, N);
  const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    N,
    mode: "approx",
    stride,
    M,
    O,
    myDist: mine.distribution,
    oppDist: theirs.distribution,
    myThreshold: mine.threshold,
    oppThreshold: theirs.threshold,
    myModel,
    oppModel,
    solveMs: ended - started,
  };
}

/** Async wrapper with progress updates and event-loop breathing room. */
export async function solveStrategyAsync(
  myModel: PlayerModel,
  oppModel: PlayerModel,
  N: number,
  progress?: ProgressFn,
): Promise<StrategyTables> {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const candidates = thresholdCandidates(N);

  let bestMineB = candidates[0] ?? 1;
  let bestMineD = thresholdDistribution(myModel, N, bestMineB);
  let bestMineMean = 0;
  for (let s = 0; s <= N; s += 1) bestMineMean += s * bestMineD[s];

  for (let i = 0; i < candidates.length; i += 1) {
    const B = candidates[i];
    if (B !== bestMineB) {
      const D = thresholdDistribution(myModel, N, B);
      let mean = 0;
      for (let s = 0; s <= N; s += 1) mean += s * D[s];
      if (mean > bestMineMean + 1e-12) {
        bestMineMean = mean;
        bestMineB = B;
        bestMineD = D;
      }
    }
    progress?.({
      percent: 4 + Math.round(((i + 1) / candidates.length) * 23),
      label: `评估我方收手阈值 ${i + 1}/${candidates.length}`,
    });
    if (i % 3 === 2) await yieldToMain();
  }

  let bestOppB = candidates[0] ?? 1;
  let bestOppD = thresholdDistribution(oppModel, N, bestOppB);
  let bestOppMean = 0;
  for (let s = 0; s <= N; s += 1) bestOppMean += s * bestOppD[s];

  for (let i = 0; i < candidates.length; i += 1) {
    const B = candidates[i];
    if (B !== bestOppB) {
      const D = thresholdDistribution(oppModel, N, B);
      let mean = 0;
      for (let s = 0; s <= N; s += 1) mean += s * D[s];
      if (mean > bestOppMean + 1e-12) {
        bestOppMean = mean;
        bestOppB = B;
        bestOppD = D;
      }
    }
    progress?.({
      percent: 27 + Math.round(((i + 1) / candidates.length) * 23),
      label: `评估对手收手阈值 ${i + 1}/${candidates.length}`,
    });
    if (i % 3 === 2) await yieldToMain();
  }

  progress?.({ percent: 55, label: "求解对局胜率" });
  await yieldToMain();
  const { M, O, stride } = solveFixedRace(bestMineD, bestOppD, N);
  progress?.({ percent: 100, label: "策略就绪" });

  const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    N,
    mode: "approx",
    stride,
    M,
    O,
    myDist: bestMineD,
    oppDist: bestOppD,
    myThreshold: bestMineB,
    oppThreshold: bestOppB,
    myModel,
    oppModel,
    solveMs: ended - started,
  };
}
