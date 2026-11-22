import {
  defaultDice,
  dieFromPreset,
  DICE_PRESETS,
  PRESET_BY_ID,
} from "./dice";
import type { DieSpec, FaceProbs } from "./dice";

export const GAME_VERSION = 2;
export const STORAGE_KEY = "kcd2-dice-advisor-v2";

export type Phase = "my-turn" | "opp-turn" | "won" | "lost";
export type LogTone = "neutral" | "good" | "bad" | "gold";

export interface HeldDie {
  id: number;
  face: number;
}

export interface LogEntry {
  id: string;
  text: string;
  tone: LogTone;
}

export interface GameState {
  version: number;
  target: number;
  myScore: number;
  oppScore: number;
  phase: Phase;
  turnPoints: number;
  activeIds: number[];
  faces: Record<number, number>;
  selected: number[];
  held: HeldDie[];
  myDice: DieSpec[];
  oppDice: DieSpec[];
  manual: boolean;
  log: LogEntry[];
}

export type GameAction =
  | { type: "ROLL"; faces: Record<number, number> }
  | { type: "SET_FACE"; dieIndex: number; face: number }
  | { type: "TOGGLE_SELECT"; dieIndex: number }
  | { type: "SET_SELECTION"; ids: number[] }
  | { type: "CLEAR_SELECTION" }
  | { type: "HOLD"; ids: number[]; score: number; hot: boolean }
  | { type: "BANK"; ids: number[]; score: number }
  | { type: "BUST" }
  | { type: "OPP_END"; points: number }
  | { type: "START_MY_TURN" }
  | {
      type: "SET_CONFIG";
      target: number;
      myScore: number;
      oppScore: number;
      myDice: DieSpec[];
      oppDice: DieSpec[];
    }
  | { type: "SET_DICE"; side: "my" | "opp"; dice: DieSpec[] }
  | { type: "SET_MANUAL"; manual: boolean }
  | { type: "SET_TURN_POINTS"; points: number }
  | { type: "SET_DIE_PRESET"; slot: number; presetId: string }
  | { type: "NEW_GAME"; target: number; myDice: DieSpec[]; oppDice: DieSpec[] }
  | { type: "CLEAR_LOG" };

export const ALL_DIE_IDS = [0, 1, 2, 3, 4, 5];

export function effectiveTarget(target: number): number {
  const rounded = Math.round(target / 50) * 50;
  return Math.max(50, Math.min(10000, rounded || 2000));
}

export function scoreUnits(score: number): number {
  return Math.round(score / 50);
}

export function remainingPoints(target: number, score: number): number {
  return Math.max(0, effectiveTarget(target) - Math.round(score / 50) * 50);
}

export function activeDiceCount(state: GameState): number {
  return state.activeIds.length;
}

export function makeLog(text: string, tone: LogTone = "neutral"): LogEntry {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    tone,
  };
}

function withLog(state: GameState, text: string, tone: LogTone = "neutral"): GameState {
  return { ...state, log: [makeLog(text, tone), ...state.log].slice(0, 14) };
}

function resetTurnFields(state: GameState): GameState {
  return {
    ...state,
    turnPoints: 0,
    activeIds: [...ALL_DIE_IDS],
    faces: {},
    selected: [],
    held: [],
  };
}

function phaseFromScores(target: number, myScore: number, oppScore: number): Phase {
  if (myScore >= target) return "won";
  if (oppScore >= target) return "lost";
  return "my-turn";
}

export function createInitialGame(
  target = 2000,
  myDice: DieSpec[] = defaultDice(),
  oppDice: DieSpec[] = defaultDice(),
): GameState {
  const safeTarget = effectiveTarget(target);
  return {
    version: GAME_VERSION,
    target: safeTarget,
    myScore: 0,
    oppScore: 0,
    phase: "my-turn",
    turnPoints: 0,
    activeIds: [...ALL_DIE_IDS],
    faces: {},
    selected: [],
    held: [],
    myDice,
    oppDice,
    manual: false,
    log: [
      makeLog(`新对局开始，目标 ${safeTarget} 分。你执先手。`, "gold"),
    ],
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "ROLL": {
      if (state.phase !== "my-turn") return state;
      const faces: Record<number, number> = {};
      for (const id of state.activeIds) {
        const face = action.faces[id];
        if (!face) return state;
        faces[id] = face;
      }
      return { ...state, faces, selected: [] };
    }
    case "SET_FACE": {
      if (state.phase !== "my-turn") return state;
      if (!state.activeIds.includes(action.dieIndex)) return state;
      if (action.face < 1 || action.face > 6) return state;
      return {
        ...state,
        faces: { ...state.faces, [action.dieIndex]: action.face },
      };
    }
    case "TOGGLE_SELECT": {
      if (state.phase !== "my-turn") return state;
      if (!state.activeIds.includes(action.dieIndex)) return state;
      const selected = state.selected.includes(action.dieIndex)
        ? state.selected.filter((id) => id !== action.dieIndex)
        : [...state.selected, action.dieIndex];
      return { ...state, selected };
    }
    case "SET_SELECTION": {
      if (state.phase !== "my-turn") return state;
      const selected = action.ids.filter((id) => state.activeIds.includes(id));
      return { ...state, selected: [...new Set(selected)].sort((a, b) => a - b) };
    }
    case "CLEAR_SELECTION":
      return { ...state, selected: [] };
    case "HOLD": {
      if (state.phase !== "my-turn" || action.score <= 0) return state;
      if (action.ids.length === 0) return state;
      const remaining = state.activeIds.filter((id) => !action.ids.includes(id));
      const hot = remaining.length === 0;
      const held = hot
        ? []
        : [
            ...state.held,
            ...action.ids.map((id) => ({ id, face: state.faces[id] })),
          ].filter((item) => item.face > 0);
      const nextActive = hot ? [...ALL_DIE_IDS] : remaining;
      const next: GameState = {
        ...state,
        turnPoints: state.turnPoints + action.score,
        activeIds: nextActive,
        faces: {},
        selected: [],
        held,
      };
      return withLog(
        next,
        hot
          ? `全骰得分！拿走 ${action.ids.length} 颗（+${action.score}），热骰重掷 6 颗。`
          : `拿走 ${action.ids.length} 颗（+${action.score}），剩余 ${nextActive.length} 颗。`,
        hot ? "gold" : "neutral",
      );
    }
    case "BANK": {
      if (state.phase !== "my-turn" || action.score <= 0) return state;
      const gained = state.turnPoints + action.score;
      const myScore = state.myScore + gained;
      const phase = myScore >= state.target ? "won" : "opp-turn";
      const next = resetTurnFields({
        ...state,
        myScore,
        phase,
      });
      return withLog(
        next,
        phase === "won"
          ? `收手 +${gained}，总分 ${myScore}，达到目标！`
          : `收手 +${gained}，总分 ${myScore}，轮到对手。`,
        phase === "won" ? "gold" : "good",
      );
    }
    case "BUST": {
      if (state.phase !== "my-turn") return state;
      const lost = state.turnPoints;
      const next = resetTurnFields({ ...state, phase: "opp-turn" });
      return withLog(
        next,
        lost > 0
          ? `爆点！本回合 ${lost} 分全部失去，轮到对手。`
          : "爆点！轮到对手。",
        "bad",
      );
    }
    case "OPP_END": {
      if (state.phase !== "opp-turn") return state;
      const points = Math.max(0, Math.round(action.points));
      const oppScore = state.oppScore + points;
      const phase = oppScore >= state.target ? "lost" : "my-turn";
      const next = resetTurnFields({ ...state, oppScore, phase });
      return withLog(
        next,
        phase === "lost"
          ? `对手 +${points}，总分 ${oppScore}，达到目标。`
          : `对手 +${points}，总分 ${oppScore}，轮到你。`,
        phase === "lost" ? "bad" : "neutral",
      );
    }
    case "START_MY_TURN": {
      if (state.phase !== "opp-turn") return state;
      return withLog(resetTurnFields({ ...state, phase: "my-turn" }), "轮到你。");
    }
    case "SET_CONFIG": {
      const target = effectiveTarget(action.target);
      const myScore = Math.max(0, Math.round(Math.min(action.myScore, 100000)));
      const oppScore = Math.max(0, Math.round(Math.min(action.oppScore, 100000)));
      const phase = phaseFromScores(target, myScore, oppScore);
      const next = resetTurnFields({
        ...state,
        target,
        myScore,
        oppScore,
        phase,
        myDice: action.myDice,
        oppDice: action.oppDice,
      });
      return withLog(
        next,
        `对局设置已更新：目标 ${target}，你 ${myScore} / 对手 ${oppScore}。`,
        "gold",
      );
    }
    case "SET_DICE": {
      const dice = action.dice;
      const next = resetTurnFields({
        ...state,
        [action.side === "my" ? "myDice" : "oppDice"]: dice,
        phase: state.phase === "won" || state.phase === "lost" ? state.phase : "my-turn",
      });
      return withLog(next, action.side === "my" ? "我方骰组已更新。" : "对手骰组已更新。");
    }
    case "SET_MANUAL":
      return { ...state, manual: action.manual };
    case "SET_TURN_POINTS": {
      if (state.phase !== "my-turn") return state;
      const points = Math.max(0, Math.min(1_000_000, Math.round(action.points / 50) * 50));
      return { ...state, turnPoints: points };
    }
    case "SET_DIE_PRESET": {
      if (action.slot < 0 || action.slot >= 6) return state;
      const preset = PRESET_BY_ID.get(action.presetId);
      if (!preset) return state;
      const myDice = state.myDice.slice();
      myDice[action.slot] = dieFromPreset(preset, action.slot);
      return { ...state, myDice };
    }
    case "NEW_GAME": {
      const fresh = createInitialGame(action.target, action.myDice, action.oppDice);
      return {
        ...fresh,
        log: [makeLog(`新对局开始，目标 ${fresh.target} 分。你执先手。`, "gold")],
      };
    }
    case "CLEAR_LOG":
      return { ...state, log: [] };
    default:
      return state;
  }
}

function isValidDie(value: unknown): value is DieSpec {
  if (!value || typeof value !== "object") return false;
  const die = value as Partial<DieSpec>;
  return (
    typeof die.id === "string" &&
    typeof die.name === "string" &&
    Array.isArray(die.probs) &&
    die.probs.length === 6 &&
    die.probs.every((p) => typeof p === "number" && Number.isFinite(p) && p >= 0) &&
    Math.abs(die.probs.reduce((a, b) => a + b, 0) - 1) < 0.02
  );
}

function normalizeDie(die: DieSpec, slot: number): DieSpec {
  const sum = die.probs.reduce((a, b) => a + b, 0) || 1;
  return {
    ...die,
    id: `die-${slot}`,
    probs: die.probs.map((p) => p / sum) as FaceProbs,
  };
}

export function loadGame(): GameState {
  if (typeof window === "undefined") return createInitialGame();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialGame();
    const parsed = JSON.parse(raw) as Partial<GameState>;
    if (parsed.version !== GAME_VERSION) return createInitialGame();
    if (
      !Array.isArray(parsed.myDice) ||
      !Array.isArray(parsed.oppDice) ||
      parsed.myDice.length !== 6 ||
      parsed.oppDice.length !== 6 ||
      !parsed.myDice.every(isValidDie) ||
      !parsed.oppDice.every(isValidDie)
    ) {
      return createInitialGame();
    }
    const target = effectiveTarget(Number(parsed.target) || 2000);
    const myScore = Math.max(0, Number(parsed.myScore) || 0);
    const oppScore = Math.max(0, Number(parsed.oppScore) || 0);
    let phase: Phase =
      parsed.phase === "my-turn" ||
      parsed.phase === "opp-turn" ||
      parsed.phase === "won" ||
      parsed.phase === "lost"
        ? parsed.phase
        : "my-turn";
    if (phase !== "won" && phase !== "lost") {
      phase = phaseFromScores(target, myScore, oppScore);
    }
    const activeIds =
      Array.isArray(parsed.activeIds) && parsed.activeIds.length > 0
        ? parsed.activeIds.filter((id) => Number.isInteger(id) && id >= 0 && id < 6)
        : [...ALL_DIE_IDS];
    return {
      version: GAME_VERSION,
      target,
      myScore,
      oppScore,
      phase,
      turnPoints: Math.max(0, Number(parsed.turnPoints) || 0),
      activeIds: activeIds.length ? activeIds : [...ALL_DIE_IDS],
      faces:
        parsed.faces && typeof parsed.faces === "object"
          ? (parsed.faces as Record<number, number>)
          : {},
      selected: Array.isArray(parsed.selected) ? parsed.selected : [],
      held: Array.isArray(parsed.held)
        ? parsed.held.filter(
            (h): h is HeldDie =>
              !!h && Number.isInteger(h.id) && Number.isInteger(h.face),
          )
        : [],
      myDice: parsed.myDice.map(normalizeDie),
      oppDice: parsed.oppDice.map(normalizeDie),
      manual: Boolean(parsed.manual),
      log: Array.isArray(parsed.log) ? parsed.log.slice(0, 14) : [],
    };
  } catch {
    return createInitialGame();
  }
}

export function saveGame(state: GameState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be full or disabled; the calculator still works.
  }
}

export function findPresetForDie(die: DieSpec) {
  if (die.presetId) return PRESET_BY_ID.get(die.presetId);
  const key = die.probs.map((p) => p.toFixed(4)).join(",");
  return DICE_PRESETS.find(
    (preset) => preset.probs.map((p) => p.toFixed(4)).join(",") === key,
  );
}

export function cloneDice(dice: readonly DieSpec[]): DieSpec[] {
  return dice.map((die) => ({
    ...die,
    probs: [...die.probs] as FaceProbs,
  }));
}

export { dieFromPreset };
