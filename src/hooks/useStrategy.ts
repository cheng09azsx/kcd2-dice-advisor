import { useEffect, useState } from "react";
import type { DieSpec } from "../core/dice";
import { probsSignature } from "../core/dice";
import type { PlayerModel } from "../core/model";
import { buildPlayerModel } from "../core/model";
import type { SolveProgress, StrategyTables } from "../core/strategy";
import { solveStrategyAsync } from "../core/strategy";
import { canExactSolve, solveExactGameAsync } from "../core/exact";

const modelCache = new Map<string, PlayerModel>();
const strategyCache = new Map<string, StrategyTables>();
const MAX_STRATEGY_CACHE = 4;

function getModel(dice: DieSpec[]): PlayerModel {
  const key = probsSignature(dice);
  const cached = modelCache.get(key);
  if (cached) return cached;
  const model = buildPlayerModel(dice);
  if (modelCache.size >= 8) {
    const first = modelCache.keys().next().value;
    if (first) modelCache.delete(first);
  }
  modelCache.set(key, model);
  return model;
}

function cacheStrategy(key: string, tables: StrategyTables) {
  if (strategyCache.size >= MAX_STRATEGY_CACHE) {
    const first = strategyCache.keys().next().value;
    if (first) strategyCache.delete(first);
  }
  strategyCache.set(key, tables);
}

export interface StrategyState {
  tables: StrategyTables | null;
  progress: SolveProgress | null;
  error: string | null;
  solving: boolean;
  refining: boolean;
}

export function useStrategy(
  myDice: DieSpec[],
  oppDice: DieSpec[],
  target: number,
): StrategyState {
  const [state, setState] = useState<StrategyState>({
    tables: null,
    progress: null,
    error: null,
    solving: true,
    refining: false,
  });

  const mySig = probsSignature(myDice);
  const oppSig = probsSignature(oppDice);
  const N = Math.ceil(target / 50);

  useEffect(() => {
    let cancelled = false;
    const key = `${mySig}|${oppSig}|${N}`;
    const cached = strategyCache.get(key);
    if (cached) {
      setState({
        tables: cached,
        progress: null,
        error: null,
        solving: false,
        refining: false,
      });
      return () => {
        cancelled = true;
      };
    }

    setState({
      tables: null,
      progress: { percent: 2, label: "构建骰组模型…" },
      error: null,
      solving: true,
      refining: false,
    });

    const run = async () => {
      try {
        await new Promise<void>((resolve) => setTimeout(resolve, 24));
        if (cancelled) return;
        const myModel = getModel(myDice);
        const oppModel = getModel(oppDice);
        if (cancelled) return;

        let lastPercent = 3;
        const fast = await solveStrategyAsync(myModel, oppModel, N, (progress) => {
          if (cancelled) return;
          if (progress.percent - lastPercent >= 2 || progress.percent >= 100) {
            lastPercent = progress.percent;
            setState((prev) => ({ ...prev, progress }));
          }
        });
        if (cancelled) return;

        const eligible = canExactSolve(myModel, oppModel, N);
        setState({
          tables: fast,
          progress: eligible
            ? { percent: 0, label: "准备精确求解双方最优策略…" }
            : null,
          error: null,
          solving: false,
          refining: eligible,
        });

        if (!eligible) {
          cacheStrategy(key, fast);
          return;
        }

        await new Promise<void>((resolve) => setTimeout(resolve, 60));
        if (cancelled) return;

        let lastExact = -1;
        const exact = await solveExactGameAsync(
          fast,
          (progress) => {
            if (cancelled) return;
            if (progress.percent - lastExact >= 2 || progress.percent >= 100) {
              lastExact = progress.percent;
              setState((prev) => ({ ...prev, progress }));
            }
          },
          () => cancelled,
        );
        if (cancelled) return;
        cacheStrategy(key, exact);
        setState({
          tables: exact,
          progress: null,
          error: null,
          solving: false,
          refining: false,
        });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof Error && error.message === "cancelled") return;
        setState((prev) => ({
          ...prev,
          progress: null,
          error: prev.tables ? null : error instanceof Error ? error.message : "策略计算出错",
          solving: false,
          refining: false,
        }));
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // Dice objects are represented by their probability signatures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySig, oppSig, N]);

  return state;
}
