export type ComboKind = "single" | "kind" | "straight";

export interface Combo {
  kind: ComboKind;
  faces: number[];
  count: number;
  score: number;
  label: string;
}

export interface ScoredSelection {
  score: number;
  combos: Combo[];
  counts: number[];
}

export const SCORE_UNIT = 50;
export const MAX_DICE = 6;
export const POW7 = [1, 7, 49, 343, 2401, 16807] as const;

/** Encodes counts of faces 1..6 (each 0..6) as a base-7 index. */
export function encodeCounts(counts: readonly number[]): number {
  return (
    (counts[0] ?? 0) * POW7[0] +
    (counts[1] ?? 0) * POW7[1] +
    (counts[2] ?? 0) * POW7[2] +
    (counts[3] ?? 0) * POW7[3] +
    (counts[4] ?? 0) * POW7[4] +
    (counts[5] ?? 0) * POW7[5]
  );
}

export function decodeCounts(index: number): number[] {
  const counts = new Array<number>(6).fill(0);
  let value = index;
  for (let i = 0; i < 6; i += 1) {
    counts[i] = value % 7;
    value = Math.floor(value / 7);
  }
  return counts;
}

const SCORE_TABLE = new Int16Array(117649);
SCORE_TABLE.fill(-1);
SCORE_TABLE[0] = 0;

const KEEP = (() => {
  // All count vectors with total <= 6, grouped by total.
  const byTotal: number[][] = Array.from({ length: 7 }, () => []);
  for (let total = 0; total <= 6; total += 1) {
    const counts = new Array<number>(6).fill(0);
    const walk = (face: number, left: number) => {
      if (face === 5) {
        counts[face] = left;
        byTotal[total].push(encodeCounts(counts));
        counts[face] = 0;
        return;
      }
      for (let n = 0; n <= left; n += 1) {
        counts[face] = n;
        walk(face + 1, left - n);
      }
      counts[face] = 0;
    };
    walk(0, total);
  }
  return byTotal;
})();

const RUNS = [
  { faces: [1, 2, 3, 4, 5], score: 500, label: "小顺 1-5" },
  { faces: [2, 3, 4, 5, 6], score: 750, label: "大顺 2-6" },
  { faces: [1, 2, 3, 4, 5, 6], score: 1500, label: "全顺 1-6" },
] as const;

function kindBase(face: number): number {
  return face === 1 ? 1000 : face * 100;
}

function kindScore(face: number, count: number): number {
  return kindBase(face) * 2 ** (count - 3);
}

function withOneLess(counts: number[], face: number): number[] {
  const next = counts.slice();
  next[face - 1] -= 1;
  return next;
}

function withRunRemoved(counts: number[], run: readonly number[]): number[] {
  const next = counts.slice();
  for (const face of run) next[face - 1] -= 1;
  return next;
}

/** Builds the exact max-score table for every multiset of up to six dice. */
for (let total = 1; total <= 6; total += 1) {
  for (const index of KEEP[total]) {
    const counts = decodeCounts(index);
    let best = -1;

    if (counts[0] > 0) {
      const rest = SCORE_TABLE[encodeCounts(withOneLess(counts, 1))];
      if (rest >= 0) best = Math.max(best, 100 + rest);
    }
    if (counts[4] > 0) {
      const rest = SCORE_TABLE[encodeCounts(withOneLess(counts, 5))];
      if (rest >= 0) best = Math.max(best, 50 + rest);
    }

    for (let face = 1; face <= 6; face += 1) {
      for (let n = 3; n <= counts[face - 1]; n += 1) {
        let next = counts.slice();
        next[face - 1] -= n;
        const rest = SCORE_TABLE[encodeCounts(next)];
        if (rest >= 0) best = Math.max(best, kindScore(face, n) + rest);
      }
    }

    for (const run of RUNS) {
      if (run.faces.every((face) => counts[face - 1] > 0)) {
        const rest = SCORE_TABLE[encodeCounts(withRunRemoved(counts, run.faces))];
        if (rest >= 0) best = Math.max(best, run.score + rest);
      }
    }

    SCORE_TABLE[index] = best;
  }
}

export function scoreTable(): Int16Array {
  return SCORE_TABLE;
}

/** Returns max score for a face multiset, or -1 when the selection cannot score. */
export function scoreCounts(counts: readonly number[]): number {
  if (counts.length !== 6) return -1;
  return SCORE_TABLE[encodeCounts(counts)];
}

export function scoreForFaces(faces: readonly number[]): number {
  const counts = new Array<number>(6).fill(0);
  for (const face of faces) {
    if (!Number.isInteger(face) || face < 1 || face > 6) return -1;
    counts[face - 1] += 1;
    if (counts[face - 1] > 6) return -1;
  }
  return scoreCounts(counts);
}

function kindLabel(face: number, count: number): string {
  const names = ["", "", "", "三条", "四条", "五条", "六条"];
  return `${names[count] ?? `${count}条`} ${face}`;
}

/**
 * Returns the highest-scoring breakdown for the selected dice.
 * The breakdown is one of possibly several optimal partitions.
 */
export function scoreSelectionDetailed(faces: readonly number[]): ScoredSelection | null {
  const counts = new Array<number>(6).fill(0);
  for (const face of faces) {
    if (!Number.isInteger(face) || face < 1 || face > 6) return null;
    counts[face - 1] += 1;
    if (counts[face - 1] > 6) return null;
  }
  const total = faces.length;
  if (total === 0 || total > 6) return null;

  const target = scoreCounts(counts);
  if (target <= 0) return null;

  const combos: Combo[] = [];
  const current = counts.slice();

  const reconstruct = (): boolean => {
    if (current.every((n) => n === 0)) return true;

    // Prefer long kinds and straights in the display, then singles.
    for (let face = 1; face <= 6; face += 1) {
      for (let n = Math.min(6, current[face - 1]); n >= 3; n -= 1) {
        if (current[face - 1] < n) continue;
        const next = current.slice();
        next[face - 1] -= n;
        const rest = scoreCounts(next);
        const value = kindScore(face, n);
        if (rest >= 0 && value + rest === scoreCounts(current)) {
          current[face - 1] -= n;
          combos.push({
            kind: "kind",
            faces: Array.from({ length: n }, () => face),
            count: n,
            score: value,
            label: kindLabel(face, n),
          });
          if (reconstruct()) return true;
          combos.pop();
          current[face - 1] += n;
        }
      }
    }

    for (const run of RUNS) {
      if (run.faces.every((face) => current[face - 1] > 0)) {
        const next = withRunRemoved(current, run.faces);
        const rest = scoreCounts(next);
        if (rest >= 0 && run.score + rest === scoreCounts(current)) {
          for (const face of run.faces) current[face - 1] -= 1;
          combos.push({
            kind: "straight",
            faces: [...run.faces],
            count: run.faces.length,
            score: run.score,
            label: run.label,
          });
          if (reconstruct()) return true;
          combos.pop();
          for (const face of run.faces) current[face - 1] += 1;
        }
      }
    }

    if (current[0] > 0) {
      const next = withOneLess(current, 1);
      const rest = scoreCounts(next);
      if (rest >= 0 && 100 + rest === scoreCounts(current)) {
        current[0] -= 1;
        combos.push({ kind: "single", faces: [1], count: 1, score: 100, label: "单 1" });
        if (reconstruct()) return true;
        combos.pop();
        current[0] += 1;
      }
    }

    if (current[4] > 0) {
      const next = withOneLess(current, 5);
      const rest = scoreCounts(next);
      if (rest >= 0 && 50 + rest === scoreCounts(current)) {
        current[4] -= 1;
        combos.push({ kind: "single", faces: [5], count: 1, score: 50, label: "单 5" });
        if (reconstruct()) return true;
        combos.pop();
        current[4] += 1;
      }
    }

    return false;
  };

  if (!reconstruct()) return null;
  combos.sort((a, b) => b.score - a.score || b.count - a.count);
  return { score: target, combos, counts };
}

export function comboText(combos: readonly Combo[]): string {
  return combos.map((combo) => combo.label).join(" + ");
}
