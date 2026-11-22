import { MAX_DICE, SCORE_UNIT, encodeCounts, scoreCounts } from "./scoring";
import type { DieSpec, FaceProbs } from "./dice";

export interface DieGroup {
  probs: FaceProbs;
  count: number;
  diceIndices: number[];
  color: string;
  name: string;
}

export interface FaceDistribution {
  faces: number[];
  prob: number;
}

export interface StateOutcomes {
  /** Probability of each distinct face multiset while rolling this active state. */
  probs: Float64Array;
  /** Start offset of this outcome's option list. */
  optionStart: Int32Array;
  /** Encoded next active state. */
  optionNext: Int32Array;
  /** Points gained, in 50-point units. */
  optionGain: Int32Array;
  /** Probability that this roll has no legal scoring selection. */
  bustProb: number;
}

export interface PlayerModel {
  dice: DieSpec[];
  groups: DieGroup[];
  groupIndexByDie: number[];
  groupCounts: number[];
  radices: number[];
  strides: number[];
  stateCount: number;
  stateCounts: number[][];
  stateTotal: number[];
  fullState: number;
  groupDists: FaceDistribution[][][];
  states: StateOutcomes[];
  sumOutcomes: number;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

function probabilityKey(probs: readonly number[]): string {
  // Reduce ratios so 16.7% and 1/6 group together despite rounding.
  const values = probs.map((p) => Math.max(0, Math.round(p * 1_000_000)));
  const divisor = values.reduce((acc, value) => gcd(acc, value), 0) || 1;
  return values.map((value) => Math.round(value / divisor)).join(":");
}

function groupDice(dice: readonly DieSpec[]): DieGroup[] {
  const byKey = new Map<string, DieGroup>();
  dice.forEach((die, index) => {
    const key = probabilityKey(die.probs);
    const found = byKey.get(key);
    if (found) {
      found.count += 1;
      found.diceIndices.push(index);
      return;
    }
    byKey.set(key, {
      probs: [...die.probs] as FaceProbs,
      count: 1,
      diceIndices: [index],
      color: die.color,
      name: die.name,
    });
  });
  return [...byKey.values()];
}

const FACTORIAL = [1, 1, 2, 6, 24, 120, 720];

function buildFaceDistributions(probs: readonly number[], count: number): FaceDistribution[] {
  const result: FaceDistribution[] = [];
  const faces = new Array<number>(6).fill(0);

  const walk = (face: number, left: number) => {
    if (face === 5) {
      faces[face] = left;
      let probability = FACTORIAL[count];
      for (const n of faces) probability /= FACTORIAL[n];
      for (let f = 0; f < 6; f += 1) {
        if (faces[f] > 0) probability *= probs[f] ** faces[f];
      }
      if (probability > 0) result.push({ faces: faces.slice(), prob: probability });
      faces[face] = 0;
      return;
    }
    for (let n = 0; n <= left; n += 1) {
      faces[face] = n;
      walk(face + 1, left - n);
    }
    faces[face] = 0;
  };

  walk(0, count);
  return result;
}

function encodeWithStrides(counts: readonly number[], strides: readonly number[]): number {
  let value = 0;
  for (let i = 0; i < counts.length; i += 1) value += counts[i] * strides[i];
  return value;
}

function decodeWithRadices(index: number, radices: readonly number[]): number[] {
  const counts = new Array<number>(radices.length).fill(0);
  let value = index;
  for (let i = 0; i < radices.length; i += 1) {
    counts[i] = value % radices[i];
    value = Math.floor(value / radices[i]);
  }
  return counts;
}

interface RawOption {
  next: number;
  gain: number;
}

function buildOutcomeOptions(
  activeCounts: readonly number[],
  rolled: readonly number[][],
  totalDice: number,
  fullState: number,
  strides: readonly number[],
): RawOption[] {
  const groupTotal = activeCounts.length;
  const heldByGroup = new Array<number>(groupTotal).fill(0);
  const heldFaces = new Array<number>(6).fill(0);
  const seen = new Set<number>();
  const options: RawOption[] = [];

  const walkGroup = (group: number) => {
    if (group === groupTotal) {
      let heldTotal = 0;
      for (const n of heldByGroup) heldTotal += n;
      if (heldTotal === 0) return;

      const score = scoreCounts(heldFaces);
      if (score <= 0) return;

      let nextState: number;
      if (heldTotal === totalDice) {
        nextState = fullState;
      } else {
        const nextCounts = activeCounts.map((n, i) => n - heldByGroup[i]);
        nextState = encodeWithStrides(nextCounts, strides);
      }
      const gain = score / SCORE_UNIT;
      const key = nextState * 256 + gain;
      if (!seen.has(key)) {
        seen.add(key);
        options.push({ next: nextState, gain });
      }
      return;
    }

    const rolledFaces = rolled[group];
    const walkFace = (face: number) => {
      if (face === 6) {
        walkGroup(group + 1);
        return;
      }
      for (let n = 0; n <= rolledFaces[face]; n += 1) {
        heldByGroup[group] += n;
        heldFaces[face] += n;
        walkFace(face + 1);
        heldFaces[face] -= n;
        heldByGroup[group] -= n;
      }
    };
    walkFace(0);
  };

  walkGroup(0);
  options.sort((a, b) => b.gain - a.gain || a.next - b.next);
  return options;
}

export function buildPlayerModel(dice: readonly DieSpec[]): PlayerModel {
  if (dice.length !== MAX_DICE) throw new Error("PlayerModel expects exactly six dice");
  const groups = groupDice(dice);
  const groupCounts = groups.map((group) => group.count);
  const groupIndexByDie = new Array<number>(dice.length).fill(0);
  groups.forEach((group, groupIndex) => {
    for (const dieIndex of group.diceIndices) groupIndexByDie[dieIndex] = groupIndex;
  });

  const radices = groupCounts.map((count) => count + 1);
  const strides: number[] = [];
  let stateCount = 1;
  for (let i = 0; i < radices.length; i += 1) {
    strides[i] = stateCount;
    stateCount *= radices[i];
  }

  const stateCounts: number[][] = [];
  const stateTotal: number[] = [];
  for (let index = 0; index < stateCount; index += 1) {
    const counts = decodeWithRadices(index, radices);
    stateCounts.push(counts);
    stateTotal.push(counts.reduce((a, b) => a + b, 0));
  }
  const fullState = encodeWithStrides(groupCounts, strides);

  const groupDists = groups.map((group) =>
    Array.from({ length: group.count + 1 }, (_, count) =>
      buildFaceDistributions(group.probs, count),
    ),
  );

  const states: StateOutcomes[] = [];
  let sumOutcomes = 0;

  for (let state = 0; state < stateCount; state += 1) {
    const activeCounts = stateCounts[state];
    const totalDice = stateTotal[state];
    if (totalDice === 0) {
      states.push({
        probs: new Float64Array(0),
        optionStart: new Int32Array(1),
        optionNext: new Int32Array(0),
        optionGain: new Int32Array(0),
        bustProb: 1,
      });
      continue;
    }

    interface RawOutcome {
      prob: number;
      options: RawOption[];
    }
    const outcomes: RawOutcome[] = [];
    const rolled = groups.map(() => new Array<number>(6).fill(0));

    const walkRolls = (group: number, probability: number) => {
      if (group === groups.length) {
        const options = buildOutcomeOptions(
          activeCounts,
          rolled,
          totalDice,
          fullState,
          strides,
        );
        outcomes.push({ prob: probability, options });
        return;
      }
      const dists = groupDists[group][activeCounts[group]];
      for (const dist of dists) {
        rolled[group] = dist.faces;
        walkRolls(group + 1, probability * dist.prob);
      }
    };
    walkRolls(0, 1);

    const probs = new Float64Array(outcomes.length);
    const optionStart = new Int32Array(outcomes.length + 1);
    let optionCount = 0;
    for (const outcome of outcomes) optionCount += outcome.options.length;
    const optionNext = new Int32Array(optionCount);
    const optionGain = new Int32Array(optionCount);

    let cursor = 0;
    let bustProb = 0;
    outcomes.forEach((outcome, index) => {
      probs[index] = outcome.prob;
      optionStart[index] = cursor;
      if (outcome.options.length === 0) bustProb += outcome.prob;
      for (const option of outcome.options) {
        optionNext[cursor] = option.next;
        optionGain[cursor] = option.gain;
        cursor += 1;
      }
    });
    optionStart[outcomes.length] = cursor;

    states.push({ probs, optionStart, optionNext, optionGain, bustProb });
    sumOutcomes += outcomes.length;
  }

  return {
    dice: [...dice],
    groups,
    groupIndexByDie,
    groupCounts,
    radices,
    strides,
    stateCount,
    stateCounts,
    stateTotal,
    fullState,
    groupDists,
    states,
    sumOutcomes,
  };
}

/** Active group counts for a set of physical dice indices. */
export function activeGroupCounts(model: PlayerModel, dieIndices: readonly number[]): number[] {
  const counts = new Array<number>(model.groups.length).fill(0);
  for (const index of dieIndices) {
    const group = model.groupIndexByDie[index];
    if (group === undefined) throw new Error(`Unknown die index ${index}`);
    counts[group] += 1;
  }
  return counts;
}

export function activeStateIndex(model: PlayerModel, dieIndices: readonly number[]): number {
  return encodeWithStrides(activeGroupCounts(model, dieIndices), model.strides);
}

export function stateIndexFromCounts(model: PlayerModel, counts: readonly number[]): number {
  return encodeWithStrides(counts, model.strides);
}

export function activeCount(model: PlayerModel, dieIndices: readonly number[]): number {
  return dieIndices.length;
}

/** Helper for tests and diagnostics. */
export function outcomeProbabilitySum(model: PlayerModel): number {
  let sum = 0;
  for (const state of model.states) {
    for (const p of state.probs) sum += p;
  }
  return sum;
}

export { encodeCounts };
