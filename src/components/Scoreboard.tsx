import type { Phase } from "../core/game";
import { formatScore, pct } from "../utils/format";
import { Icon } from "./Icon";

export interface ScoreboardProps {
  target: number;
  myScore: number;
  oppScore: number;
  phase: Phase;
  turnPoints: number;
  winProb: number | null;
  solving?: boolean;
  onEdit: () => void;
  onUndo: () => void;
  onNewGame: () => void;
  canUndo: boolean;
  lastSolveMs?: number;
}

function remaining(target: number, score: number): number {
  return Math.max(0, target - score);
}

export function Scoreboard({
  target,
  myScore,
  oppScore,
  phase,
  turnPoints,
  winProb,
  solving = false,
  onEdit,
  onUndo,
  onNewGame,
  canUndo,
  lastSolveMs,
}: ScoreboardProps) {
  const myRemaining = remaining(target, myScore);
  const oppRemaining = remaining(target, oppScore);
  const myProgress = Math.max(0, Math.min(1, myScore / target));
  const oppProgress = Math.max(0, Math.min(1, oppScore / target));
  const turnLabel =
    phase === "my-turn"
      ? "你的回合"
      : phase === "opp-turn"
        ? "对手回合"
        : phase === "won"
          ? "你已获胜"
          : "对手获胜";
  const phaseTone =
    phase === "won" ? "good" : phase === "lost" ? "bad" : phase === "my-turn" ? "active" : "wait";

  return (
    <section className="scoreboard panel" aria-label="对局比分">
      <div className="score-side score-side-me">
        <div className="score-side-head">
          <span className="score-side-icon">
            <Icon name="crown" size={16} />
          </span>
          <span>你</span>
          <span className={`turn-dot ${phase === "my-turn" ? "is-live" : ""}`} />
        </div>
        <div className="score-value">{formatScore(myScore)}</div>
        <div className="score-track">
          <span style={{ width: `${myProgress * 100}%` }} />
        </div>
        <div className="score-meta">
          {myRemaining > 0 ? `还差 ${formatScore(myRemaining)}` : "已达标"}
          {phase === "my-turn" && turnPoints > 0 && (
            <span className="score-turn-points">本回合 +{formatScore(turnPoints)}</span>
          )}
        </div>
      </div>

      <div className="score-center">
        <span className="score-center-eyebrow">先到</span>
        <div className="score-target">
          <Icon name="target" size={18} />
          <span>{formatScore(target)}</span>
        </div>
        <div className={`turn-badge is-${phaseTone}`}>
          <span className="turn-badge-dot" />
          {turnLabel}
        </div>
        <div className="score-win">
          <span>我方胜率</span>
          <strong>{solving ? "计算中" : pct(winProb)}</strong>
        </div>
        {lastSolveMs !== undefined && lastSolveMs > 0 && (
          <span className="score-solve-time">策略求解 {Math.round(lastSolveMs)} ms</span>
        )}
      </div>

      <div className="score-side score-side-opp">
        <div className="score-side-head">
          <span className="score-side-icon opp">
            <Icon name="bot" size={16} />
          </span>
          <span>对手</span>
          <span className={`turn-dot ${phase === "opp-turn" ? "is-live is-opp" : ""}`} />
        </div>
        <div className="score-value">{formatScore(oppScore)}</div>
        <div className="score-track is-opp">
          <span style={{ width: `${oppProgress * 100}%` }} />
        </div>
        <div className="score-meta">
          {oppRemaining > 0 ? `还差 ${formatScore(oppRemaining)}` : "已达标"}
        </div>
      </div>

      <div className="score-actions">
        <button type="button" className="icon-button" onClick={onUndo} disabled={!canUndo} title="撤销上一步">
          <Icon name="undo" size={17} />
        </button>
        <button type="button" className="icon-button" onClick={onEdit} title="对局与骰组设置">
          <Icon name="settings" size={17} />
        </button>
        <button type="button" className="icon-button danger" onClick={onNewGame} title="新对局">
          <Icon name="rotate" size={17} />
        </button>
      </div>
    </section>
  );
}
