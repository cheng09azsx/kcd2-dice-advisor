import type { Phase } from "../core/game";
import { formatScore } from "../utils/format";
import { Icon } from "./Icon";

export function GameOver({
  phase,
  target,
  myScore,
  oppScore,
  onNewGame,
  onDismiss,
}: {
  phase: Phase;
  target: number;
  myScore: number;
  oppScore: number;
  onNewGame: () => void;
  onDismiss: () => void;
}) {
  const won = phase === "won";
  return (
    <div className="gameover-backdrop">
      <div className={`gameover-card ${won ? "is-win" : "is-loss"}`}>
        <div className="gameover-crest">
          <Icon name={won ? "crown" : "skull"} size={34} />
        </div>
        <div className="eyebrow">MATCH OVER · 对局结束</div>
        <h2>{won ? "胜局" : "败局"}</h2>
        <p className="gameover-sub">
          {won ? "你在对手之前达到了目标分。" : "对手先达到了目标分。"}
        </p>
        <div className="gameover-score">
          <div>
            <span>你</span>
            <strong>{formatScore(myScore)}</strong>
          </div>
          <span className="gameover-divider">:</span>
          <div>
            <span>对手</span>
            <strong>{formatScore(oppScore)}</strong>
          </div>
        </div>
        <div className="gameover-target">目标 {formatScore(target)} 分</div>
        <div className="gameover-actions">
          <button type="button" className="button ghost" onClick={onDismiss}>
            查看牌桌
          </button>
          <button type="button" className="button primary" onClick={onNewGame}>
            <Icon name="rotate" size={15} /> 再来一局
          </button>
        </div>
        <span className="gameover-foot">KCD2 · DICE COUNSEL</span>
      </div>
    </div>
  );
}
