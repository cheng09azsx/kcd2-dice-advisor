import type { PlayerModel } from "./model";
import type { ProgressFn, StrategyTables } from "./strategy";

/**
 * Exact game-theoretic refinement on the full 50-point state grid.
 *
 * The fast threshold-race model supplies a warm start. We then solve the true
 * two-player optimal-stopping game: M[a][b] is our win probability on our turn
 * with a points left, while O[b][a] is the opponent's win probability on their
 * turn with b points left. Turn-level decisions enumerate every legal take and
 * every bank/continue choice, so the only approximations left are the 1e-3
 * convergence tolerance and the model's scoring assumptions.
 */
export async function solveExactGameAsync(
  warm: StrategyTables,
  progress?: ProgressFn,
  cancelled?: () => boolean,
): Promise<StrategyTables> {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const { N, stride, myModel, oppModel } = warm;
  const size = stride * stride;
  const M = warm.M.slice();
  const O = warm.O.slice();
  const myS = myModel.stateCount;
  const oppS = oppModel.stateCount;
  const VM = new Float64Array(N * myS);
  const VO = new Float64Array(N * oppS);
  const bankM = new Float64Array(N + 1);
  const bankO = new Float64Array(N + 1);
  const tolerance = 1e-3;
  const maxIterations = 16;

  const turn = (
    model: PlayerModel,
    a: number,
    b: number,
    bust: number,
    other: Float64Array,
    bank: Float64Array,
    V: Float64Array,
  ): number => {
    for (let q = 1; q < a; q += 1) bank[q] = 1 - other[b * stride + (a - q)];
    const S = model.stateCount;
    const full = model.fullState;
    const states = model.states;

    for (let p = a - 1; p >= 0; p -= 1) {
      const row = p * S;
      for (let st = 1; st < S; st += 1) {
        const outcomes = states[st];
        const probs = outcomes.probs;
        if (probs.length === 0) continue;
        let expected = 0;
        for (let oi = 0; oi < probs.length; oi += 1) {
          const start = outcomes.optionStart[oi];
          const end = outcomes.optionStart[oi + 1];
          let best = -1;
          for (let o = start; o < end; o += 1) {
            const q = p + outcomes.optionGain[o];
            let value: number;
            if (q >= a) {
              value = 1;
            } else {
              value = bank[q];
              const next = V[q * S + outcomes.optionNext[o]];
              if (next > value) value = next;
            }
            if (value > best) best = value;
          }
          expected += probs[oi] * (best >= 0 ? best : bust);
        }
        V[row + st] = expected;
      }
    }
    return V[full];
  };

  let lastYield = started;
  for (let total = 2; total <= 2 * N; total += 1) {
    const minA = Math.max(1, total - N);
    const maxA = Math.min(N, total - 1);
    for (let a = minA; a <= maxA; a += 1) {
      const b = total - a;
      let x = M[a * stride + b];
      let y = O[b * stride + a];
      for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        const nx = turn(myModel, a, b, 1 - y, O, bankM, VM);
        const ny = turn(oppModel, b, a, 1 - nx, M, bankO, VO);
        const converged = Math.abs(nx - x) < tolerance && Math.abs(ny - y) < tolerance;
        x = nx;
        y = ny;
        if (converged) break;
      }
      M[a * stride + b] = x;
      O[b * stride + a] = y;
    }

    if (cancelled?.()) throw new Error("cancelled");
    progress?.({
      percent: Math.round(((total - 1) / (2 * N - 1)) * 100),
      label: `双方最优精确求解 ${total}/${2 * N}`,
    });
    if (total % 2 === 0 || performance.now() - lastYield > 45) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      lastYield = performance.now();
    }
  }

  const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    ...warm,
    M,
    O,
    mode: "exact",
    solveMs: ended - started,
  };
}

export function canExactSolve(myModel: PlayerModel, oppModel: PlayerModel, N: number): boolean {
  const complexity = myModel.sumOutcomes + oppModel.sumOutcomes;
  return N <= 55 && complexity <= 25_000;
}
