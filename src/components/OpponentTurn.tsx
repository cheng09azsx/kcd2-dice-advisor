import { useState } from "react";
import type { GameState } from "../core/game";
import { formatScore, pct } from "../utils/format";
import { DieMini } from "./Dice";
import { Icon } from "./Icon";

export function OpponentTurn({
  game,
  winProb,
  onEnd,
}: {
  game: GameState;
  winProb: number | null;
  onEnd: (points: number) => void;
}) {
  const [points, setPoints] = useState("0");
  const numeric = Math.max(0, Math.round((Number(points) || 0) / 50) * 50);
  const wouldLose = game.oppScore + numeric >= game.target;

  return (
    <section className="opponent-panel panel">
      <div className="opponent-hero">
        <div className="opponent-avatar">
          <Icon name="bot" size={28} />
        </div>
        <div>
          <div className="eyebrow">OPPONENT · 对手回合</div>
          <h2>对手正在掷骰</h2>
          <p>记录对手本回合最终入账的分数。爆点填 0；对手达到目标分则本局结束。</p>
        </div>
        <div className="opponent-win">
          <span>你的胜率</span>
          <strong>{pct(winProb)}</strong>
        </div>
      </div>

      <div className="opponent-body">
        <div className="opponent-score-card">
          <span>对手当前总分</span>
          <strong>{formatScore(game.oppScore)}</strong>
          <span>还差 {formatScore(Math.max(0, game.target - game.oppScore))} 分</span>
        </div>

        <div className="opponent-form">
          <label className="form-field">
            <span>对手本回合得分</span>
            <input
              type="number"
              min={0}
              step={50}
              value={points}
              onChange={(event) => setPoints(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
            />
            <small>按 50 分取整。若对手爆点，填 0。</small>
          </label>
          <div className="opponent-quick">
            {[0, 100, 200, 300, 500].map((value) => (
              <button
                key={value}
                type="button"
                className={`quick-chip ${numeric === value ? "is-active" : ""}`}
                onClick={() => setPoints(String(value))}
              >
                {value === 0 ? "爆点 / 0" : `+${value}`}
              </button>
            ))}
          </div>
        </div>

        <div className="opponent-actions">
          <button
            type="button"
            className="button ghost"
            onClick={() => onEnd(0)}
          >
            <Icon name="skull" size={15} /> 对手爆点
          </button>
          <button
            type="button"
            className={`button ${wouldLose ? "danger" : "primary"}`}
            onClick={() => onEnd(numeric)}
          >
            <Icon name="arrow" size={15} />
            {wouldLose ? `对手达到目标 · 结束对局` : "记录并轮到我"}
          </button>
        </div>
      </div>

      <div className="opponent-dice">
        <div className="section-label">
          <span>对手骰组</span>
          <span>概率型</span>
        </div>
        <div className="opponent-dice-row">
          {game.oppDice.map((die, index) => {
            const top = die.probs.indexOf(Math.max(...die.probs));
            return (
              <div className="opponent-die" key={die.id}>
                <DieMini face={top + 1} color={die.color} />
                <div>
                  <strong>{die.name}</strong>
                  <span>主面 {top + 1} · {Math.round(die.probs[top] * 100)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
