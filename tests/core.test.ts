import { describe, expect, it } from "vitest";
import {
  scoreCounts,
  scoreForFaces,
  scoreSelectionDetailed,
} from "../src/core/scoring";
import { buildPlayerModel } from "../src/core/model";
import { defaultDice, dieFromPreset, DICE_PRESETS, PRESET_BY_ID } from "../src/core/dice";
import { solveStrategySync } from "../src/core/strategy";
import { buildTurnPolicy, evaluateRoll } from "../src/core/advice";
import { createInitialGame, gameReducer } from "../src/core/game";
import { canExactSolve, solveExactGameAsync } from "../src/core/exact";

function faces(face: number, count: number): number[] {
  return Array.from({ length: count }, () => face);
}

describe("scoring", () => {
  it("scores singles", () => {
    expect(scoreForFaces([1])).toBe(100);
    expect(scoreForFaces([5])).toBe(50);
    expect(scoreForFaces([2])).toBe(-1);
  });

  it("scores kinds with doubling", () => {
    expect(scoreForFaces([1, 1, 1])).toBe(1000);
    expect(scoreForFaces([2, 2, 2])).toBe(200);
    expect(scoreForFaces([4, 4, 4])).toBe(400);
    expect(scoreForFaces([4, 4, 4, 4])).toBe(800);
    expect(scoreForFaces([4, 4, 4, 4, 4])).toBe(1600);
    expect(scoreForFaces(faces(1, 6))).toBe(8000);
  });

  it("scores all straights", () => {
    expect(scoreForFaces([1, 2, 3, 4, 5])).toBe(500);
    expect(scoreForFaces([2, 3, 4, 5, 6])).toBe(750);
    expect(scoreForFaces([1, 2, 3, 4, 5, 6])).toBe(1500);
  });

  it("does not score three pairs", () => {
    expect(scoreForFaces([1, 1, 2, 2, 3, 3])).toBe(-1);
  });

  it("finds the best partition", () => {
    expect(scoreForFaces([1, 2, 3, 4, 5, 5])).toBe(550);
    expect(scoreForFaces([1, 1, 2, 3, 4, 5])).toBe(600);
    expect(scoreForFaces([1, 1, 1, 5, 5, 5])).toBe(1500);
  });

  it("returns a readable breakdown", () => {
    const result = scoreSelectionDetailed([1, 1, 1, 5]);
    expect(result?.score).toBe(1050);
    expect(result?.combos.map((c) => c.label).join(" + ")).toContain("三条 1");
    expect(result?.combos.map((c) => c.label).join(" + ")).toContain("单 5");
  });

  it("scores counts directly", () => {
    expect(scoreCounts([3, 0, 0, 0, 0, 0])).toBe(1000);
    expect(scoreCounts([0, 0, 0, 0, 3, 0])).toBe(500);
  });
});

describe("dice presets", () => {
  it("normalizes every preset", () => {
    for (const preset of DICE_PRESETS) {
      const sum = preset.probs.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 10);
      expect(preset.probs.every((p) => p >= 0 && p <= 1)).toBe(true);
    }
  });

  it("has a stable Saint Antiochus die", () => {
    const preset = PRESET_BY_ID.get("saint-antiochus")!;
    expect(preset.probs[2]).toBe(1);
    const dice = Array.from({ length: 6 }, (_, i) => dieFromPreset(preset, i));
    const model = buildPlayerModel(dice);
    expect(model.sumOutcomes).toBe(6);
    expect(model.fullState).toBe(6);
  });
});

describe("solver", () => {
  it("builds the ordinary model", () => {
    const model = buildPlayerModel(defaultDice());
    expect(model.stateCount).toBe(7);
    expect(model.sumOutcomes).toBe(923);
    for (let state = 1; state < model.stateCount; state += 1) {
      const outcomes = model.states[state];
      let sum = 0;
      for (const p of outcomes.probs) sum += p;
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it("builds a six-unique-dice model", () => {
    const ids = ["ordinary", "weighted", "three", "lucky", "king", "holy-trinity"];
    const dice = ids.map((id, i) => dieFromPreset(PRESET_BY_ID.get(id)!, i));
    const model = buildPlayerModel(dice);
    expect(model.stateCount).toBe(64);
    expect(model.sumOutcomes).toBe(117648);
  });

  it("produces plausible game probabilities", () => {
    const model = buildPlayerModel(defaultDice());
    const tables = solveStrategySync(model, model, 10);
    expect(tables.M[10 * 11 + 10]).toBeGreaterThan(0.5);
    expect(tables.M[10 * 11 + 10]).toBeLessThan(1);
    expect(tables.O[10 * 11 + 10]).toBeCloseTo(tables.M[10 * 11 + 10], 8);
    expect(tables.M[5 * 11 + 10]).toBeGreaterThan(tables.M[10 * 11 + 10]);
    expect(tables.M[10 * 11 + 5]).toBeLessThan(tables.M[10 * 11 + 10]);
    for (let a = 1; a <= 10; a += 1) {
      for (let b = 1; b <= 10; b += 1) {
        expect(tables.M[a * 11 + b]).toBeGreaterThanOrEqual(0);
        expect(tables.M[a * 11 + b]).toBeLessThanOrEqual(1);
        expect(tables.O[a * 11 + b]).toBeGreaterThanOrEqual(0);
        expect(tables.O[a * 11 + b]).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("turn advice", () => {
  const model = buildPlayerModel(defaultDice());
  const tables = solveStrategySync(model, model, 10);
  const policy = buildTurnPolicy(tables, 10, 10, model);

  it("recommends taking a winning hot-dice roll", () => {
    const active = [0, 1, 2, 3, 4, 5];
    const facesByDie = { 0: 1, 1: 1, 2: 1, 3: 5, 4: 5, 5: 5 };
    const advice = evaluateRoll(policy, active, facesByDie, 0, { allDice: model.dice });
    expect(advice.noScore).toBe(false);
    expect(advice.best?.score).toBe(1500);
    expect(advice.best?.value).toBe(1);
    expect(advice.best?.nextActive).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("detects bust rolls", () => {
    const active = [0, 1, 2, 3, 4, 5];
    const facesByDie = { 0: 2, 1: 3, 2: 4, 3: 6, 4: 6, 5: 2 };
    const advice = evaluateRoll(policy, active, facesByDie, 0, { allDice: model.dice });
    expect(advice.noScore).toBe(true);
    expect(advice.best).toBeNull();
    expect(advice.currentWin).toBeCloseTo(advice.bustValue, 12);
  });

  it("values a full straight correctly", () => {
    const active = [0, 1, 2, 3, 4, 5];
    const facesByDie = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
    const advice = evaluateRoll(policy, active, facesByDie, 0, { allDice: model.dice });
    expect(advice.best?.score).toBe(1500);
    expect(advice.best?.value).toBe(1);
  });

  it("handles selected dice that do not score", () => {
    const active = [0, 1, 2, 3, 4, 5];
    const facesByDie = { 0: 2, 1: 3, 2: 4, 3: 6, 4: 6, 5: 2 };
    const advice = evaluateRoll(policy, active, facesByDie, 0, {
      allDice: model.dice,
      selectedIndices: [0],
    });
    expect(advice.selected).toBeNull();
  });
});
describe("game actions", () => {
  it("edits the accumulated turn score in 50-point steps", () => {
    const game = createInitialGame();
    const next = gameReducer(game, { type: "SET_TURN_POINTS", points: 123 });
    expect(next.turnPoints).toBe(100);
  });

  it("swaps a die preset without losing the current roll", () => {
    const game = {
      ...createInitialGame(),
      faces: { 0: 3, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2 },
    };
    const next = gameReducer(game, { type: "SET_DIE_PRESET", slot: 0, presetId: "weighted" });
    expect(next.myDice[0].presetId).toBe("weighted");
    expect(next.faces[0]).toBe(3);
  });
});
describe("exact refinement", () => {
  it("refines the fast table to an exact game value", async () => {
    const model = buildPlayerModel(defaultDice());
    const fast = solveStrategySync(model, model, 2);
    expect(canExactSolve(model, model, 2)).toBe(true);
    const exact = await solveExactGameAsync(fast);
    expect(exact.mode).toBe("exact");
    expect(exact.M[2 * 3 + 2]).toBeGreaterThan(0.9);
    expect(exact.M[2 * 3 + 2]).toBeLessThanOrEqual(1);
  });

  it("skips exact solving for very diverse dice", () => {
    const ids = ["ordinary", "weighted", "three", "lucky", "king", "holy-trinity"];
    const dice = ids.map((id, i) => dieFromPreset(PRESET_BY_ID.get(id)!, i));
    const model = buildPlayerModel(dice);
    expect(canExactSolve(model, model, 40)).toBe(false);
  });
});
