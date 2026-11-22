import type { CSSProperties } from "react";
import type { GameState } from "../core/game";
import type { HoldCandidate, TurnAdvice } from "../core/advice";
import type { SolveProgress, StrategyTables } from "../core/strategy";
import { formatScore, formatSigned, pct } from "../utils/format";
import { DieMini } from "./Dice";
import { Icon } from "./Icon";

export interface AdvisorProps {
  game: GameState;
  advice: TurnAdvice | null;
  startWin: number | null;
  winProb: number | null;
  solving: boolean;
  refining: boolean;
  progress: SolveProgress | null;
  tables: StrategyTables | null;
  error: string | null;
  onSelect: (ids: number[]) => void;
  onContinue: (ids: number[]) => void;
  onBank: (ids: number[]) => void;
  onOpenRules: () => void;
}

function dicePreview(candidate: HoldCandidate, game: GameState, max = 5) {
  const shown = candidate.diceIndices.slice(0, max);
  return (
    <span className="candidate-dice">
      {shown.map((id) => (
        <DieMini key={id} face={candidate.faces[candidate.diceIndices.indexOf(id)]} color={game.myDice[id]?.color} />
      ))}
      {candidate.diceIndices.length > max && (
        <span className="candidate-more">+{candidate.diceIndices.length - max}</span>
      )}
    </span>
  );
}

function actionText(candidate: HoldCandidate | null, kind: "continue" | "bank") {
  if (!candidate) return "—";
  return kind === "continue" ? `+${candidate.score}` : `+${candidate.score}`;
}

function CandidateRow({
  candidate,
  game,
  rank,
  selected,
  onClick,
}: {
  candidate: HoldCandidate;
  game: GameState;
  rank: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`candidate-row ${selected ? "is-selected" : ""}`}
      onClick={onClick}
      title="在骰桌上选中这组骰子"
    >
      <span className="candidate-rank">{rank}</span>
      {dicePreview(candidate, game, 4)}
      <span className="candidate-score">+{candidate.score}</span>
      <span className={`candidate-action ${candidate.action}`}>
        {candidate.action === "bank" ? "收手" : "续掷"}
      </span>
      <span className="candidate-win">{pct(candidate.value)}</span>
    </button>
  );
}

function ComparisonRow({
  label,
  value,
  sub,
  active,
  disabled,
  onClick,
  icon,
}: {
  label: string;
  value: number | null | undefined;
  sub: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: "arrow" | "coins";
}) {
  return (
    <button
      type="button"
      className={`compare-row ${active ? "is-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="compare-icon">
        <Icon name={icon} size={17} />
      </span>
      <span className="compare-body">
        <span className="compare-label">{label}</span>
        <span className="compare-sub">{sub}</span>
      </span>
      <span className="compare-value">{pct(value)}</span>
    </button>
  );
}

export function Advisor({
  game,
  advice,
  startWin,
  winProb,
  solving,
  refining,
  progress,
  tables,
  error,
  onSelect,
  onContinue,
  onBank,
  onOpenRules,
}: AdvisorProps) {
  const best = advice?.best ?? null;
  const bestContinue = advice?.bestContinue ?? null;
  const bestBank = advice?.bestBank ?? null;
  const selected = advice?.selected ?? null;
  const compareContinue = selected ?? bestContinue;
  const compareBank = selected ?? bestBank;
  const compareActive = selected ? selected.action : best?.action;
  const candidates = advice?.candidates ?? [];
  const hasRoll = Boolean(advice && !advice.noScore);
  const displayWin = winProb;
  const gap = Math.max(0, game.target - game.myScore);
  const oppGap = Math.max(0, game.target - game.oppScore);
  const selectedIds = selected?.diceIndices.slice().sort((a, b) => a - b).join(",");
  const bestIds = best?.diceIndices.slice().sort((a, b) => a - b).join(",");

  const recommendationTitle = best
    ? best.action === "bank"
      ? "建议收手"
      : "建议继续掷"
    : advice?.noScore
      ? "本掷爆点"
      : "先掷骰";

  const explanation = (() => {
    if (!best) {
      if (advice?.noScore) return "没有可得分组合，本回合累计分数会全部失去；只能结束回合。";
      if (game.phase !== "my-turn") return "等待对手结束回合。";
      return "先把 6 颗骰子掷出来，参谋会根据牌面和双方分数给出拿法。";
    }
    if (best.action === "bank") {
      const total = game.turnPoints + best.score;
      const lead = game.myScore + total - game.oppScore;
      if (game.myScore + total >= game.target) {
        return `收手即可达到 ${formatScore(game.target)} 分，直接结束对局。`;
      }
      if (
        bestContinue &&
        advice &&
        bestContinue.continueValue > best.bankValue + 1e-9 &&
        bestContinue.bustNext > advice.riskBudget
      ) {
        return `继续的原始胜率略高，但下一掷爆点 ${pct(bestContinue.bustNext)} 超出自动风险预算 ${pct(advice.riskBudget)}，优先收手。`;
      }
      if (lead >= 0) {
        return `收手后你领先 ${formatScore(lead)} 分，先锁定优势，把风险交给对手。`;
      }
      return `收手后还落后 ${formatScore(-lead)} 分；继续搏的收益不足以抵消爆点风险。`;
    }
    const nextBust = best.bustNext;
    const need = Math.max(0, game.target - game.myScore - game.turnPoints - best.score);
    if (need <= 0) {
      return "这组骰子拿走后本回合已经够分，直接收手即可。";
    }
    const budget = advice?.riskBudget;
    if (budget !== undefined && nextBust <= budget) {
      return `下一掷爆点 ${pct(nextBust)}，在自动风险预算 ${pct(budget)} 内；继续推进的期望更高，还差 ${formatScore(need)} 分。`;
    }
    if (game.myScore + game.turnPoints < game.oppScore) {
      return `你仍在追赶，落后 ${formatScore(game.oppScore - game.myScore - game.turnPoints)} 分；下一掷爆点风险 ${pct(nextBust)}，但值得搏。`;
    }
    return `下一掷爆点风险 ${pct(nextBust)}，继续掷的胜率仍略高于现在收手；目标是再拿 ${formatScore(need)} 分。`;
  })();

  const hasSelectionMismatch = Boolean(selected && best && selectedIds !== bestIds);

  return (
    <aside className="advisor panel">
      <div className="advisor-head">
        <div>
          <div className="eyebrow">COUNSEL · 参谋</div>
          <h2>胜率与拿法</h2>
        </div>
        <button type="button" className="icon-button subtle" onClick={onOpenRules} title="规则与算法说明">
          <Icon name="info" size={17} />
        </button>
      </div>

      {solving && (
        <div className="solving-card">
          <div className="solving-head">
            <span className="pulse-dot" />
            <span>{progress?.label ?? "正在构建策略…"}</span>
            <strong>{progress?.percent ?? 0}%</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${progress?.percent ?? 0}%` }} />
          </div>
          <p>首次分析骰组需要一点时间；同骰组、同目标会复用结果。</p>
        </div>
      )}

      {error && (
        <div className="error-card">
          <Icon name="info" size={18} />
          <div>
            <strong>策略计算失败</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!solving && !error && tables && (
        <>
          <div className="win-hero">
            <div
              className="win-ring"
              style={{ "--win": `${(displayWin ?? 0) * 100}%` } as CSSProperties}
              aria-label={`我方胜率 ${pct(displayWin)}`}
            >
              <div className="win-ring-inner">
                <span className="win-label">{advice ? "当前行动胜率" : "起始胜率"}</span>
                <strong>{pct(displayWin)}</strong>
                <span className="win-caption">
                  {game.phase === "opp-turn" ? "对手回合" : advice ? "最优决策" : "掷骰前"}
                </span>
              </div>
            </div>
            <div className="win-facts">
              <div className="win-fact">
                <span>距目标</span>
                <strong>{formatScore(gap)}</strong>
              </div>
              <div className="win-fact">
                <span>对手还差</span>
                <strong>{formatScore(oppGap)}</strong>
              </div>
              <div className="win-fact">
                <span>本回合</span>
                <strong>+{formatScore(game.turnPoints)}</strong>
              </div>
            </div>
          </div>

          <div className={`strategy-quality ${tables.mode} ${refining ? "is-refining" : ""}`}>
            <span className="quality-dot" />
            <span>
              {tables.mode === "exact"
                ? "双方最优 · 精确博弈解"
                : refining
                  ? "快速估算 · 正在精算双方最优"
                  : "快速估算"}
            </span>
            {refining && <strong>{progress?.percent ?? 0}%</strong>}
          </div>
          {refining && (
            <div className="refine-track">
              <span style={{ width: `${progress?.percent ?? 0}%` }} />
            </div>
          )}

          {game.phase === "won" || game.phase === "lost" ? (
            <div className="wait-card">
              <div className="wait-icon">
                <Icon name={game.phase === "won" ? "crown" : "skull"} size={22} />
              </div>
              <div>
                <strong>{game.phase === "won" ? "你赢下了这一局" : "对手赢下了这一局"}</strong>
                <p>本局已经结束。可以再来一局，或在左下角调整骰组与目标分。</p>
              </div>
            </div>
          ) : game.phase === "opp-turn" ? (
            <div className="wait-card">
              <div className="wait-icon">
                <Icon name="bot" size={22} />
              </div>
              <div>
                <strong>对手回合</strong>
                <p>在左侧记录对手本回合拿到的分数，然后轮到你。参谋已计算好下一回合的起始胜率。</p>
              </div>
            </div>
          ) : hasRoll ? (
            <>
              <div className={`recommend-card ${best?.action === "bank" ? "is-bank" : "is-continue"}`}>
                <div className="recommend-top">
                  <span className="recommend-kicker">最佳行动</span>
                  <span className="recommend-tag">{recommendationTitle}</span>
                </div>
                <div className="recommend-main">
                  <div className="recommend-dice">
                    {best?.diceIndices.map((id) => (
                      <DieMini
                        key={id}
                        face={game.faces[id]}
                        color={game.myDice[id]?.color}
                        label={`骰位 ${id + 1}`}
                      />
                    ))}
                  </div>
                  <div className="recommend-score">
                    <span>拿走</span>
                    <strong>{best ? formatSigned(best.score) : "—"}</strong>
                  </div>
                </div>
                <p className="recommend-copy">{explanation}</p>
                {advice && best && (
                  <div className="risk-note">
                    <Icon name="shield" size={12} />
                    自动风险预算 <b>{pct(advice.riskBudget)}</b>
                    <span className="risk-sep">·</span>
                    本手爆点 <b>{pct(best.action === "continue" ? best.bustNext : 0)}</b>
                  </div>
                )}
                <div className="recommend-actions">
                  <button
                    type="button"
                    className="button primary wide"
                    onClick={() => {
                      if (!best) return;
                      if (best.action === "bank") onBank(best.diceIndices);
                      else onContinue(best.diceIndices);
                    }}
                    disabled={!best}
                  >
                    <Icon name={best?.action === "bank" ? "coins" : "arrow"} size={15} />
                    {best
                      ? best.action === "bank"
                        ? `按推荐收手 ${formatSigned(best.score)}`
                        : `按推荐拿走并续掷 ${formatSigned(best.score)}`
                      : "—"}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => best && onSelect(best.diceIndices)}
                    disabled={!best}
                  >
                    <Icon name="eye" size={13} />
                    {selectedIds && selectedIds === bestIds ? "已在骰桌上选中" : "仅在骰桌上选中"}
                  </button>
                </div>
              </div>

              {selected && hasSelectionMismatch && (
                <div className="selection-compare">
                  <span>你选中的组合</span>
                  <strong>+{selected.score}</strong>
                  <span className={`delta ${selected.value >= (best?.value ?? 0) ? "up" : "down"}`}>
                    {selected.value >= (best?.value ?? 0) ? "不输推荐" : `低 ${pct((best?.value ?? 0) - selected.value)}`}
                  </span>
                </div>
              )}

              <div className="compare-block">
                <div className="section-label">
                  <span>两条路</span>
                  <span>胜率</span>
                </div>
                <ComparisonRow
                  label={selected ? "续掷 · 当前选择" : "继续掷"}
                  value={compareContinue?.continueValue}
                  sub={
                    compareContinue
                      ? `拿 +${compareContinue.score}，剩 ${compareContinue.nextActive.length} 颗 · 爆点风险 ${pct(compareContinue.bustNext)}`
                      : "没有可续掷的得分组合"
                  }
                  active={compareActive === "continue"}
                  disabled={!compareContinue}
                  onClick={() => compareContinue && onSelect(compareContinue.diceIndices)}
                  icon="arrow"
                />
                <ComparisonRow
                  label={selected ? "收手 · 当前选择" : "收手"}
                  value={compareBank?.bankValue}
                  sub={
                    compareBank
                      ? `拿 +${compareBank.score}，本回合共 ${formatScore(game.turnPoints + compareBank.score)} 分`
                      : "没有可收手的得分组合"
                  }
                  active={compareActive === "bank"}
                  disabled={!compareBank}
                  onClick={() => compareBank && onSelect(compareBank.diceIndices)}
                  icon="coins"
                />
              </div>

            </>
          ) : advice?.noScore ? (
            <div className="bust-advice">
              <div className="bust-advice-icon">
                <Icon name="skull" size={22} />
              </div>
              <div>
                <strong>本掷爆点</strong>
                <p>没有可得分组合，本回合累计分数会全部失去。只能在左侧结束回合。</p>
              </div>
            </div>
          ) : (
            <div className="pre-roll-compact">
              <p>掷骰后，点组合或骰子选择拿法；参谋直接给出续掷 / 收手胜率。</p>
              <span><Icon name="spark" size={13} /> 起始胜率 {pct(startWin)}</span>
            </div>
          )}

          <div className="advisor-stats">
            <div className="advisor-stat">
              <span>自动爆点预算</span>
              <strong>{pct(advice?.riskBudget)}</strong>
            </div>
            <div className="advisor-stat">
              <span>最优续掷爆点</span>
              <strong>{pct(bestContinue?.bustNext)}</strong>
            </div>
          </div>

          <p className="advisor-footnote">
            {tables.mode === "exact"
              ? "双方最优解 · 未计徽章 / 万能骰"
              : refining
                ? "正在升级为精确解 · 可先用当前结果"
                : "快速估算 · 未计徽章 / 万能骰"}
          </p>

        </>
      )}

      <div className="advisor-bottom">
        <div className="advisor-legend">
          <span><i className="legend-dot is-gold" />推荐</span>
          <span><i className="legend-dot is-green" />最高分</span>
          <span><i className="legend-dot is-red" />爆点</span>
        </div>
        <span className="advisor-signature">KCD2 · DICE COUNSEL</span>
      </div>
    </aside>
  );
}