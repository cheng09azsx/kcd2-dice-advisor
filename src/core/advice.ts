import type { Combo } from "./scoring";
import { SCORE_UNIT, scoreSelectionDetailed } from "./scoring";
import type { DieSpec } from "./dice";
import type { PlayerModel } from "./model";
import { activeStateIndex } from "./model";
import type { StrategyTables } from "./strategy";

export interface HoldCandidate {
  mask: number;
  diceIndices: number[];
  faces: number[];
  score: number;
  gain: number;
  q: number;
  combos: Combo[];
  nextActive: number[];
  nextState: number;
  continueValue: number;
  bankValue: number;
  value: number;
  action: "continue" | "bank";
  bustNext: number;
}

export interface TurnAdvice {
  candidates: HoldCandidate[];
  best: HoldCandidate | null;
  bestContinue: HoldCandidate | null;
  bestBank: HoldCandidate | null;
  selected: HoldCandidate | null;
  startWin: number;
  currentWin: number;
  bustValue: number;
  riskBudget: number;
  noScore: boolean;
  p: number;
  a: number;
  b: number;
}

export interface TurnPolicy {
  a: number;
  b: number;
  N: number;
  stride: number;
  model: PlayerModel;
  tables: StrategyTables;
  V: Float64Array;
  bank: Float64Array;
  bustValue: number;
  startWin: number;
}

/**
 * Exact turn-level DP with the game continuation values supplied by the
 * threshold-race model. V[p][state] is the value after rolling that active
 * state with p points already banked in the current turn.
 */
export function buildTurnPolicy(
  tables: StrategyTables,
  a: number,
  b: number,
  model: PlayerModel,
): TurnPolicy {
  const { N, stride, O } = tables;
  if (a <= 0) throw new Error("buildTurnPolicy requires a > 0");
  if (b < 0 || a > N || b > N) throw new Error("remaining points out of range");

  const S = model.stateCount;
  const V = new Float64Array(a * S);
  const bank = new Float64Array(a + 1);
  bank[0] = -1;
  for (let q = 1; q < a; q += 1) {
    bank[q] = 1 - O[b * stride + (a - q)];
  }
  for (let q = a; q <= a; q += 1) bank[q] = 1;

  const bustValue = 1 - O[b * stride + a];

  for (let p = a - 1; p >= 0; p -= 1) {
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
          const value =
            q >= a
              ? 1
              : Math.max(bank[q], V[q * S + outcomes.optionNext[o]]);
          if (value > best) best = value;
        }
        expected += outcomes.probs[oi] * (best >= 0 ? best : bustValue);
      }
      V[row + state] = expected;
    }
  }

  return {
    a,
    b,
    N,
    stride,
    model,
    tables,
    V,
    bank,
    bustValue,
    startWin: V[model.fullState],
  };
}

function subsetMask(activeIds: readonly number[], selected: readonly number[]): number {
  let mask = 0;
  for (const index of activeIds) {
    if (selected.includes(index)) mask |= 1 << index;
  }
  return mask;
}

function maskToIndices(activeIds: readonly number[], mask: number): number[] {
  return activeIds.filter((index) => (mask & (1 << index)) !== 0);
}

function keyForCandidate(nextState: number, gain: number): number {
  return nextState * 512 + gain;
}

/**
 * Automatic, state-dependent bust budget. The budget is the extra win
 * probability that continuing buys over the best bank, floored at 8% and
 * capped at 35%. This is an epsilon-constraint: a continuation is allowed only
 * when its next-roll bust chance fits the budget; otherwise the same take is
 * banked.
 */
function applyRiskBudget(candidate: HoldCandidate, budget: number): HoldCandidate {
  const canContinue = candidate.bustNext <= budget + 1e-12;
  const action: "continue" | "bank" =
    canContinue && candidate.continueValue > candidate.bankValue + 1e-12 ? "continue" : "bank";
  return {
    ...candidate,
    action,
    value: action === "bank" ? candidate.bankValue : candidate.continueValue,
  };
}

export interface EvaluateOptions {
  selectedIndices?: readonly number[];
  allDice: readonly DieSpec[];
}

export function evaluateRoll(
  policy: TurnPolicy,
  activeIds: readonly number[],
  facesByDie: Readonly<Record<number, number>>,
  p: number,
  options: EvaluateOptions = { allDice: policy.model.dice },
): TurnAdvice {
  const { a, b, model, V, bank, bustValue } = policy;
  const S = model.stateCount;
  const allDice = options.allDice;
  const candidatesByNext = new Map<number, HoldCandidate>();
  let noScore = true;

  const n = activeIds.length;
  const limit = 1 << n;
  for (let local = 1; local < limit; local += 1) {
    const selected: number[] = [];
    for (let i = 0; i < n; i += 1) {
      if (local & (1 << i)) selected.push(activeIds[i]);
    }
    const faces: number[] = [];
    let complete = true;
    for (const id of selected) {
      const face = facesByDie[id];
      if (!face) {
        complete = false;
        break;
      }
      faces.push(face);
    }
    if (!complete) continue;

    const scored = scoreSelectionDetailed(faces);
    if (!scored || scored.score <= 0) continue;
    noScore = false;

    const gain = scored.score / SCORE_UNIT;
    const remaining = activeIds.filter((id) => !selected.includes(id));
    const nextActive = remaining.length === 0 ? allDice.map((_, index) => index) : remaining;
    const nextState = activeStateIndex(model, nextActive);
    const q = p + gain;
    const continueValue = q >= a ? 1 : V[q * S + nextState];
    const bankValue = q >= a ? 1 : bank[q] ?? 1 - policy.tables.O[b * policy.stride + (a - q)];
    const value = Math.max(continueValue, bankValue);
    const action: "continue" | "bank" = bankValue > continueValue + 1e-12 ? "bank" : "continue";
    const candidate: HoldCandidate = {
      mask: subsetMask(activeIds, selected),
      diceIndices: selected,
      faces,
      score: scored.score,
      gain,
      q,
      combos: scored.combos,
      nextActive,
      nextState,
      continueValue,
      bankValue,
      value,
      action,
      bustNext: model.states[nextState].bustProb,
    };

    const existing = candidatesByNext.get(nextState);
    if (!existing || candidate.gain > existing.gain || candidate.mask < existing.mask) {
      candidatesByNext.set(nextState, candidate);
    }
  }

  const raw = [...candidatesByNext.values()];
  let rawBestContinue = 0;
  let rawBestBank = 0;
  for (const candidate of raw) {
    if (candidate.continueValue > rawBestContinue) rawBestContinue = candidate.continueValue;
    if (candidate.bankValue > rawBestBank) rawBestBank = candidate.bankValue;
  }

  const riskBudget = Math.min(
    0.35,
    Math.max(0.08, 0.08 + Math.max(0, rawBestContinue - rawBestBank)),
  );
  const candidates = raw
    .map((candidate) => applyRiskBudget(candidate, riskBudget))
    .sort(
      (x, y) =>
        y.value - x.value ||
        Number(y.action === "bank") - Number(x.action === "bank") ||
        y.gain - x.gain ||
        x.bustNext - y.bustNext,
    );

  let bestContinue: HoldCandidate | null = null;
  let bestBank: HoldCandidate | null = null;
  for (const candidate of candidates) {
    if (!bestContinue || candidate.continueValue > bestContinue.continueValue + 1e-12) {
      bestContinue = candidate;
    }
    if (
      !bestBank ||
      candidate.bankValue > bestBank.bankValue + 1e-12 ||
      (Math.abs(candidate.bankValue - bestBank.bankValue) < 1e-12 && candidate.gain > bestBank.gain)
    ) {
      bestBank = candidate;
    }
  }

  const best = candidates[0] ?? null;
  let selected: HoldCandidate | null = null;
  if (options.selectedIndices && options.selectedIndices.length > 0) {
    const wanted = subsetMask(activeIds, options.selectedIndices);
    selected = candidates.find((candidate) => candidate.mask === wanted) ?? null;
    if (!selected) {
      const faces: number[] = [];
      let complete = true;
      for (const id of options.selectedIndices) {
        const face = facesByDie[id];
        if (!face) {
          complete = false;
          break;
        }
        faces.push(face);
      }
      if (complete) {
        const scored = scoreSelectionDetailed(faces);
        if (scored && scored.score > 0) {
          const gain = scored.score / SCORE_UNIT;
          const remaining = activeIds.filter((id) => !options.selectedIndices!.includes(id));
          const nextActive = remaining.length === 0 ? allDice.map((_, index) => index) : remaining;
          const nextState = activeStateIndex(model, nextActive);
          const q = p + gain;
          const continueValue = q >= a ? 1 : V[q * S + nextState];
          const bankValue = q >= a ? 1 : bank[q] ?? 1 - policy.tables.O[b * policy.stride + (a - q)];
          selected = applyRiskBudget(
            {
              mask: wanted,
              diceIndices: [...options.selectedIndices],
              faces,
              score: scored.score,
              gain,
              q,
              combos: scored.combos,
              nextActive,
              nextState,
              continueValue,
              bankValue,
              value: Math.max(continueValue, bankValue),
              action: "continue",
              bustNext: model.states[nextState].bustProb,
            },
            riskBudget,
          );
        }
      }
    }
  }

  return {
    candidates,
    best,
    bestContinue,
    bestBank,
    selected,
    startWin: policy.startWin,
    currentWin: best?.value ?? bustValue,
    bustValue,
    riskBudget,
    noScore,
    p,
    a,
    b,
  };
}

export function indicesToMask(indices: readonly number[]): number {
  let mask = 0;
  for (const index of indices) mask |= 1 << index;
  return mask;
}

export function maskToDice(activeIds: readonly number[], mask: number): number[] {
  return maskToIndices(activeIds, mask);
}
