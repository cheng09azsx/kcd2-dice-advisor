import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FaceProbs } from "./core/dice";
import {
  cloneDice,
  createInitialGame,
  effectiveTarget,
  gameReducer,
  loadGame,
  saveGame,
} from "./core/game";
import type { GameAction, GameState } from "./core/game";
import type { TurnPolicy } from "./core/advice";
import { buildTurnPolicy, evaluateRoll } from "./core/advice";
import { scoreSelectionDetailed } from "./core/scoring";
import { useStrategy } from "./hooks/useStrategy";
import { Advisor } from "./components/Advisor";
import { ConfigModal } from "./components/ConfigModal";
import type { ConfigTab, ConfigValues } from "./components/ConfigModal";
import { DiceBoard } from "./components/DiceBoard";
import { GameOver } from "./components/GameOver";
import { Icon } from "./components/Icon";
import { OpponentTurn } from "./components/OpponentTurn";
import { Scoreboard } from "./components/Scoreboard";
import { Toast } from "./components/Toast";
import type { ToastTone } from "./components/Toast";
import { DieMini } from "./components/Dice";

interface ToastState {
  id: number;
  text: string;
  tone: ToastTone;
}

function sampleFace(probs: FaceProbs): number {
  let value = Math.random();
  for (let i = 0; i < 6; i += 1) {
    value -= probs[i];
    if (value <= 0) return i + 1;
  }
  return 6;
}

function pickFaces(activeIds: number[], dice: GameState["myDice"]): Record<number, number> {
  const faces: Record<number, number> = {};
  for (const id of activeIds) faces[id] = sampleFace(dice[id].probs);
  return faces;
}

function topFace(probs: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < probs.length; i += 1) if (probs[i] > probs[best]) best = i;
  return best + 1;
}

function FinishedBoard({
  game,
  onNewGame,
  onEdit,
}: {
  game: GameState;
  onNewGame: () => void;
  onEdit: () => void;
}) {
  const won = game.phase === "won";
  return (
    <section className={`board panel finished-board ${won ? "is-win" : "is-loss"}`}>
      <div className="finished-crest">
        <Icon name={won ? "crown" : "skull"} size={38} />
      </div>
      <div className="eyebrow">MATCH COMPLETE</div>
      <h2>{won ? "胜局已定" : "本局落败"}</h2>
      <p>
        {won
          ? "你在对手之前达到目标分。可以再来一局，或调整骰组继续研究。"
          : "对手先达到目标分。复盘一下收手时机，再试一局。"}
      </p>
      <div className="finished-score">
        <span>你 {game.myScore.toLocaleString("zh-CN")}</span>
        <span className="dot-sep">·</span>
        <span>对手 {game.oppScore.toLocaleString("zh-CN")}</span>
      </div>
      <div className="finished-actions">
        <button type="button" className="button primary" onClick={onNewGame}>
          <Icon name="rotate" size={16} /> 再来一局
        </button>
        <button type="button" className="button ghost" onClick={onEdit}>
          <Icon name="settings" size={16} /> 调整骰组
        </button>
      </div>
    </section>
  );
}

export default function App() {
  const [game, setGame] = useState<GameState>(() => loadGame());
  const [rolling, setRolling] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [configTab, setConfigTab] = useState<ConfigTab>("match");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [overDismissed, setOverDismissed] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const undoRef = useRef<GameState[]>([]);
  const toastTimer = useRef<number | null>(null);
  const rollTimer = useRef<number | null>(null);

  const strategy = useStrategy(game.myDice, game.oppDice, game.target);
  const tables = strategy.tables;
  const N = tables?.N ?? Math.ceil(game.target / 50);

  const myRemaining = Math.max(0, N - Math.round(game.myScore / 50));
  const oppRemaining = Math.max(0, N - Math.round(game.oppScore / 50));
  const isMyTurn = game.phase === "my-turn";

  const policy = useMemo<TurnPolicy | null>(() => {
    if (!tables || !isMyTurn || myRemaining <= 0 || oppRemaining <= 0) return null;
    if (tables.N !== N) return null;
    try {
      return buildTurnPolicy(tables, myRemaining, oppRemaining, tables.myModel);
    } catch {
      return null;
    }
  }, [tables, isMyTurn, myRemaining, oppRemaining, N]);

  const facesComplete =
    game.activeIds.length > 0 && game.activeIds.every((id) => Boolean(game.faces[id]));

  const advice = useMemo(() => {
    if (!policy || !facesComplete) return null;
    try {
      return evaluateRoll(
        policy,
        game.activeIds,
        game.faces,
        Math.round(game.turnPoints / 50),
        { allDice: game.myDice, selectedIndices: game.selected },
      );
    } catch {
      return null;
    }
  }, [policy, facesComplete, game.activeIds, game.faces, game.turnPoints, game.selected, game.myDice]);

  const winProb = useMemo(() => {
    if (game.phase === "won") return 1;
    if (game.phase === "lost") return 0;
    if (game.phase === "opp-turn" && tables) {
      if (oppRemaining <= 0) return 0;
      if (myRemaining <= 0) return 1;
      return 1 - tables.O[oppRemaining * tables.stride + myRemaining];
    }
    if (game.phase === "my-turn") {
      return advice?.currentWin ?? policy?.startWin ?? null;
    }
    return null;
  }, [game.phase, tables, oppRemaining, myRemaining, advice, policy]);

  const startWin = policy?.startWin ?? null;
  const qualityLabel = !tables
    ? strategy.solving
      ? "计算中"
      : "—"
    : tables.mode === "exact"
      ? "精确"
      : strategy.refining
        ? `精算 ${strategy.progress?.percent ?? 0}%`
        : "估算";
  const policyReady = Boolean(policy) && !strategy.solving;
  const showGameOver =
    (game.phase === "won" || game.phase === "lost") && !overDismissed;

  const showToast = useCallback((text: string, tone: ToastTone = "neutral") => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, tone });
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    saveGame(game);
  }, [game]);

  useEffect(() => {
    setOverDismissed(false);
  }, [game.phase]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (rollTimer.current) window.clearTimeout(rollTimer.current);
    };
  }, []);

  const pushUndo = useCallback((snapshot: GameState) => {
    undoRef.current.push(snapshot);
    if (undoRef.current.length > 24) undoRef.current.shift();
    setUndoCount(undoRef.current.length);
  }, []);

  const commit = useCallback(
    (action: GameAction) => {
      pushUndo(game);
      setGame(gameReducer(game, action));
    },
    [game, pushUndo],
  );

  const handleUndo = () => {
    const snapshot = undoRef.current.pop();
    if (!snapshot) return;
    if (rollTimer.current) {
      window.clearTimeout(rollTimer.current);
      rollTimer.current = null;
    }
    setRolling(false);
    setUndoCount(undoRef.current.length);
    setGame(snapshot);
    setToast(null);
  };

  const handleRoll = () => {
    if (!isMyTurn || rolling || facesComplete || !policyReady) return;
    const active = [...game.activeIds];
    const dice = game.myDice;
    pushUndo(game);
    setRolling(true);
    if (rollTimer.current) window.clearTimeout(rollTimer.current);
    rollTimer.current = window.setTimeout(() => {
      const faces = pickFaces(active, dice);
      setGame((prev) => {
        if (prev.phase !== "my-turn") return prev;
        if (prev.activeIds.join(",") !== active.join(",")) return prev;
        return gameReducer(prev, { type: "ROLL", faces });
      });
      setRolling(false);
    }, game.manual ? 180 : 420);
  };

  const handleClickDie = (dieIndex: number) => {
    if (!isMyTurn || rolling || !facesComplete) return;
    setGame((prev) => gameReducer(prev, { type: "TOGGLE_SELECT", dieIndex }));
  };

  const handleSetFace = (dieIndex: number, face: number) => {
    if (!isMyTurn) return;
    setGame((prev) => gameReducer(prev, { type: "SET_FACE", dieIndex, face }));
  };

  const handleManualToggle = () => {
    setGame((prev) => gameReducer(prev, { type: "SET_MANUAL", manual: !prev.manual }));
  };

  const handleTurnPointsChange = (points: number) => {
    setGame((prev) => gameReducer(prev, { type: "SET_TURN_POINTS", points }));
  };

  const handleDiePresetChange = (slot: number, presetId: string) => {
    setGame((prev) => gameReducer(prev, { type: "SET_DIE_PRESET", slot, presetId }));
  };

  const handleSelectRecommended = (ids: number[]) => {
    setGame((prev) => gameReducer(prev, { type: "SET_SELECTION", ids }));
  };

  const handleClearSelection = () => {
    setGame((prev) => gameReducer(prev, { type: "CLEAR_SELECTION" }));
  };

  const validateHold = (ids: number[]) => {
    if (!ids.length) return null;
    const faces: number[] = [];
    for (const id of ids) {
      const face = game.faces[id];
      if (!face) return null;
      faces.push(face);
    }
    const scored = scoreSelectionDetailed(faces);
    if (!scored || scored.score <= 0) return null;
    return { score: scored.score, hot: ids.length === game.activeIds.length };
  };

  const handleContinue = (ids: number[]) => {
    if (!isMyTurn) return;
    const valid = validateHold(ids);
    if (!valid) {
      showToast("这组骰子不能全部计分，请重新选择。", "bad");
      return;
    }
    commit({ type: "HOLD", ids, score: valid.score, hot: valid.hot });
    showToast(
      valid.hot
        ? `全骰得分 +${valid.score}，热骰重掷 6 颗。`
        : `拿走 +${valid.score} 分，继续掷。`,
      valid.hot ? "gold" : "good",
    );
  };

  const handleBank = (ids: number[]) => {
    if (!isMyTurn) return;
    const valid = validateHold(ids);
    if (!valid) {
      showToast("这组骰子不能全部计分，请重新选择。", "bad");
      return;
    }
    const total = game.turnPoints + valid.score;
    const willWin = game.myScore + total >= game.target;
    commit({ type: "BANK", ids, score: valid.score });
    showToast(
      willWin
        ? `收手 +${total}，达到目标分！`
        : `收手 +${total}，轮到对手。`,
      willWin ? "gold" : "good",
    );
  };

  const handleBust = () => {
    if (!isMyTurn) return;
    commit({ type: "BUST" });
    showToast("爆点，本回合分数清零。", "bad");
  };

  const handleOpponentEnd = (points: number) => {
    if (game.phase !== "opp-turn") return;
    const willLose = game.oppScore + points >= game.target;
    commit({ type: "OPP_END", points });
    showToast(
      willLose ? "对手达到目标分，本局结束。" : `对手 +${points}，轮到你。`,
      willLose ? "bad" : "neutral",
    );
  };

  const openConfig = (tab: ConfigTab = "match") => {
    setConfigTab(tab);
    setConfigOpen(true);
  };

  const handleApplyConfig = (values: ConfigValues) => {
    if (rollTimer.current) {
      window.clearTimeout(rollTimer.current);
      rollTimer.current = null;
    }
    setRolling(false);
    pushUndo(game);
    setGame(
      gameReducer(game, {
        type: "SET_CONFIG",
        target: values.target,
        myScore: values.myScore,
        oppScore: values.oppScore,
        myDice: values.myDice,
        oppDice: values.oppDice,
      }),
    );
    setConfigOpen(false);
    setOverDismissed(false);
    showToast("设置已应用，新回合开始。", "good");
  };

  const handleNewGame = () => {
    if (rollTimer.current) {
      window.clearTimeout(rollTimer.current);
      rollTimer.current = null;
    }
    setRolling(false);
    undoRef.current = [];
    setUndoCount(0);
    setOverDismissed(false);
    setGame(
      createInitialGame(
        effectiveTarget(game.target),
        cloneDice(game.myDice),
        cloneDice(game.oppDice),
      ),
    );
    showToast("新对局开始。", "gold");
  };

  const handleDismissGameOver = () => setOverDismissed(true);

  const configValues: ConfigValues = {
    target: game.target,
    myScore: game.myScore,
    oppScore: game.oppScore,
    myDice: game.myDice,
    oppDice: game.oppDice,
  };

  return (
    <div className="app">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="grain" />

      <header className="topbar">
        <div className="brand">
          <span className="brand-crest">
            <Icon name="shield" size={22} />
            <span className="brand-crest-die">
              <Icon name="dice" size={14} />
            </span>
          </span>
          <div>
            <div className="brand-title">骰局</div>
            <div className="brand-sub">KCD2 DICE COUNSEL</div>
          </div>
        </div>
        <div className="topbar-center">
          <span className="topbar-pill">
            <span className="live-dot" />
            1v1 · 先到 {game.target.toLocaleString("zh-CN")}
          </span>
          <span className="topbar-pill quiet">离线可用</span>
        </div>
        <div className="topbar-actions">
          <button type="button" className="button ghost small" onClick={() => openConfig("match")}>
            <Icon name="settings" size={15} /> 对局设置
          </button>
          <button type="button" className="button primary small" onClick={handleNewGame}>
            <Icon name="rotate" size={15} /> 新对局
          </button>
        </div>
      </header>

      <main className="shell">
        <Scoreboard
          target={game.target}
          myScore={game.myScore}
          oppScore={game.oppScore}
          phase={game.phase}
          turnPoints={game.turnPoints}
          winProb={winProb}
          solving={strategy.solving}
          onEdit={() => openConfig("match")}
          onUndo={handleUndo}
          onNewGame={handleNewGame}
          canUndo={undoCount > 0}
          lastSolveMs={tables?.solveMs}
        />

        <div className="main-grid">
          {isMyTurn ? (
            <DiceBoard
              game={game}
              advice={advice}
              policyReady={policyReady}
              solving={strategy.solving}
              rolling={rolling}
              startWin={startWin}
              qualityLabel={qualityLabel}
              riskBudget={advice?.riskBudget ?? null}
              onRoll={handleRoll}
              onToggleSelect={handleClickDie}
              onSetFace={handleSetFace}
              onManualToggle={handleManualToggle}
              onTurnPointsChange={handleTurnPointsChange}
              onDiePresetChange={handleDiePresetChange}
              onOpenDiceConfig={() => openConfig("my")}
              onSelectRecommended={handleSelectRecommended}
              onClearSelection={handleClearSelection}
              onContinue={handleContinue}
              onBank={handleBank}
              onBust={handleBust}
            />
          ) : game.phase === "opp-turn" ? (
            <OpponentTurn game={game} winProb={winProb} onEnd={handleOpponentEnd} />
          ) : (
            <FinishedBoard game={game} onNewGame={handleNewGame} onEdit={() => openConfig("my")} />
          )}

          <Advisor
            game={game}
            advice={advice}
            startWin={startWin}
            winProb={winProb}
            solving={strategy.solving}
            refining={strategy.refining}
            progress={strategy.progress}
            tables={tables}
            error={strategy.error}
            onSelect={handleSelectRecommended}
            onContinue={handleContinue}
            onBank={handleBank}
            onOpenRules={() => openConfig("rules")}
          />
        </div>

        <footer className="table-footer panel">
          <div className="footer-dice-block">
            <div className="section-label">
              <span>你的骰组</span>
              <button type="button" className="text-button" onClick={() => openConfig("my")}>
                调整
              </button>
            </div>
            <div className="footer-dice-row">
              {game.myDice.map((die, index) => (
                <span className="footer-die" key={die.id} title={die.name}>
                  <DieMini face={topFace(die.probs)} color={die.color} />
                  <span>{die.name}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="footer-dice-block">
            <div className="section-label">
              <span>对手骰组</span>
              <button type="button" className="text-button" onClick={() => openConfig("opp")}>
                调整
              </button>
            </div>
            <div className="footer-dice-row">
              {game.oppDice.map((die) => (
                <span className="footer-die" key={die.id} title={die.name}>
                  <DieMini face={topFace(die.probs)} color={die.color} />
                  <span>{die.name}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="footer-log">
            <div className="section-label">
              <span>本局记录</span>
              {game.log.length > 0 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setGame((prev) => gameReducer(prev, { type: "CLEAR_LOG" }))}
                >
                  清空
                </button>
              )}
            </div>
            <div className="log-lines">
              {game.log.slice(0, 4).map((entry) => (
                <div className={`log-line is-${entry.tone}`} key={entry.id}>
                  <span className="log-dot" />
                  <span>{entry.text}</span>
                </div>
              ))}
              {game.log.length === 0 && <span className="log-empty">还没有记录。</span>}
            </div>
          </div>
        </footer>

        <div className="app-footnote">
          <span>KCD2 Dice Counsel · 本地计算，不上传数据</span>
          <span className="dot-sep">·</span>
          <span>胜率为模型估计，特殊效果请以游戏内为准</span>
          <span className="dot-sep">·</span>
          <button type="button" className="text-button" onClick={() => openConfig("rules")}>
            规则与算法
          </button>
        </div>
      </main>

      <ConfigModal
        open={configOpen}
        initialTab={configTab}
        values={configValues}
        onClose={() => setConfigOpen(false)}
        onApply={handleApplyConfig}
      />

      {showGameOver && (
        <GameOver
          phase={game.phase}
          target={game.target}
          myScore={game.myScore}
          oppScore={game.oppScore}
          onNewGame={handleNewGame}
          onDismiss={handleDismissGameOver}
        />
      )}

      {toast && <Toast key={toast.id} text={toast.text} tone={toast.tone} />}
    </div>
  );
}
