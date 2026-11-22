import { useMemo } from "react";
import type { GameState } from "../core/game";
import type { TurnAdvice } from "../core/advice";
import { comboText } from "../core/scoring";
import { DICE_PRESETS } from "../core/dice";
import { formatSigned, pct } from "../utils/format";
import { DieCard, DieMini, FacePicker } from "./Dice";
import { Icon } from "./Icon";

export interface DiceBoardProps {
  game: GameState;
  advice: TurnAdvice | null;
  policyReady: boolean;
  solving: boolean;
  rolling: boolean;
  startWin: number | null;
  qualityLabel: string;
  riskBudget: number | null;
  onRoll: () => void;
  onToggleSelect: (dieIndex: number) => void;
  onSetFace: (dieIndex: number, face: number) => void;
  onManualToggle: () => void;
  onTurnPointsChange: (points: number) => void;
  onDiePresetChange: (slot: number, presetId: string) => void;
  onOpenDiceConfig: () => void;
  onSelectRecommended: (ids: number[]) => void;
  onClearSelection: () => void;
  onContinue: (ids: number[]) => void;
  onBank: (ids: number[]) => void;
  onBust: () => void;
}

export function DiceBoard({
  game,
  advice,
  policyReady,
  solving,
  rolling,
  startWin,
  qualityLabel,
  riskBudget,
  onRoll,
  onToggleSelect,
  onSetFace,
  onManualToggle,
  onTurnPointsChange,
  onDiePresetChange,
  onOpenDiceConfig,
  onSelectRecommended,
  onClearSelection,
  onContinue,
  onBank,
  onBust,
}: DiceBoardProps) {
  const activeSet = useMemo(() => new Set(game.activeIds), [game.activeIds]);
  const heldByIndex = useMemo(() => {
    const map = new Map<number, number>();
    for (const held of game.held) map.set(held.id, held.face);
    return map;
  }, [game.held]);

  const facesComplete =
    game.activeIds.length > 0 && game.activeIds.every((id) => Boolean(game.faces[id]));
  const selectedValid = Boolean(advice?.selected);
  const selectedPending = game.selected.length > 0;
  const selectedInvalid = selectedPending && facesComplete && !selectedValid;
  const noScore = Boolean(facesComplete && advice?.noScore);

  const continueTarget = selectedValid ? advice?.selected : advice?.bestContinue;
  const bankTarget = selectedValid ? advice?.selected : advice?.bestBank;
  const bestAction = advice?.best?.action;
  const selectedIsBest = Boolean(
    selectedValid && advice?.selected && advice?.best && advice.selected.mask === advice.best.mask,
  );
  const highlightContinue = bestAction === "continue" && (!selectedValid || selectedIsBest);
  const highlightBank = bestAction === "bank" && (!selectedValid || selectedIsBest);
  const tipAction = selectedValid ? advice?.selected?.action : bestAction;
  const actionDisabled = !policyReady || solving || !facesComplete || selectedInvalid || noScore;

  const recommendedIds = advice?.best?.diceIndices ?? [];
  const selectedIds = [...game.selected].sort((a, b) => a - b);
  const selectedKey = selectedIds.join(",");
  const comboRows = advice?.candidates.slice(0, 12) ?? [];
  const maxScore = advice ? Math.max(...advice.candidates.map((candidate) => candidate.score)) : 0;
  const showRecommendedButton =
    facesComplete &&
    !noScore &&
    recommendedIds.length > 0 &&
    (selectedIds.length === 0 ||
      selectedIds.join(",") !== recommendedIds.slice().sort((a, b) => a - b).join(","));

  const handleRecommended = () => {
    if (recommendedIds.length) onSelectRecommended(recommendedIds);
  };

  const handleContinue = () => {
    if (actionDisabled) return;
    const target = selectedValid ? advice?.selected : advice?.bestContinue;
    if (target) onContinue(target.diceIndices);
  };

  const handleBank = () => {
    if (actionDisabled) return;
    const target = selectedValid ? advice?.selected : advice?.bestBank;
    if (target) onBank(target.diceIndices);
  };

  return (
    <section className={`board panel ${game.manual ? "is-manual" : ""}`}>
      <div className="board-head">
        <div>
          <div className="eyebrow">TABLE · 骰桌</div>
          <h2>
            {game.turnPoints > 0 ? (
              <>
                本回合 <span className="gold-text">+{game.turnPoints.toLocaleString("zh-CN")}</span>
              </>
            ) : (
              "第一掷"
            )}
          </h2>
          <p className="board-sub">
            {facesComplete
              ? noScore
                ? "没有可得分组合，结束回合。"
                : "点组合或骰子选择拿法。"
              : game.manual
                ? "手动录入点数。"
                : "掷骰后选择拿法。"}
          </p>
        </div>
        <div className="board-head-right">
          {riskBudget !== null && <span className="board-risk">预算 {pct(riskBudget)}</span>}
          <span className="board-quality">{qualityLabel}</span>
          <div className="board-head-stats">
          <span className="mini-stat">
            <Icon name="dice" size={14} />
            场上 {game.activeIds.length} 颗
          </span>
          <span className="mini-stat">
            <Icon name="coins" size={14} />
            已拿 {game.held.length} 颗
          </span>
          </div>
        </div>
      </div>

      {game.held.length > 0 && (
        <div className="held-tray">
          <span className="held-tray-label">本回合已拿走</span>
          <div className="held-tray-dice">
            {game.held.map((held) => (
              <span key={held.id} className="held-chip">
                <DieMini face={held.face} color={game.myDice[held.id]?.color} dim />
                <span>{held.face}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={`dice-row ${rolling ? "is-rolling" : ""} ${noScore ? "is-bust" : ""}`}>
        {game.myDice.map((die, index) => {
          const isActive = activeSet.has(index);
          const face = isActive ? (game.faces[index] ?? null) : (heldByIndex.get(index) ?? null);
          const isHeld = !isActive && heldByIndex.has(index);
          const selected = game.selected.includes(index);
          const canSelect = isActive && facesComplete && !noScore && policyReady;
          return (
            <div className="die-slot" key={die.id}>
              <DieCard
                die={die}
                face={face}
                index={index}
                selected={selected}
                held={isHeld}
                rolling={rolling && isActive}
                disabled={!isActive || !canSelect}
                onClick={canSelect ? () => onToggleSelect(index) : undefined}
              />
              <div className="die-meta">
                <span className="die-color-dot" style={{ background: die.color }} />
                <select
                  className="die-type-select"
                  value={die.presetId ?? "custom"}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "custom") onOpenDiceConfig();
                    else onDiePresetChange(index, value);
                  }}
                  title={`更换第 ${index + 1} 颗骰子的类型`}
                  aria-label={`第 ${index + 1} 颗骰子的类型`}
                >
                  {!die.presetId && <option value="custom">自定义概率</option>}
                  {(["基础", "灌铅", "恶魔", "圣物", "牙齿"] as const).map((category) => (
                    <optgroup key={category} label={category}>
                      {DICE_PRESETS.filter((p) => p.category === category).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="custom">自定义 / 管理骰组…</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {game.manual && (
        <div className="manual-tray">
          <div className="manual-tray-head">
            <span>
              <Icon name="eye" size={14} /> 手动录入
            </span>
            <span>只录入当前场上的 {game.activeIds.length} 颗</span>
          </div>
          <div className="manual-pickers">
            {game.activeIds.map((id) => (
              <FacePicker
                key={id}
                die={game.myDice[id]}
                face={game.faces[id] ?? null}
                onChange={(face) => onSetFace(id, face)}
                disabled={rolling}
              />
            ))}
          </div>
        </div>
      )}

      <div className="board-controls">
        <button
          type="button"
          className="button primary roll-button"
          onClick={onRoll}
          disabled={rolling || facesComplete || !policyReady}
        >
          <Icon name={facesComplete ? "check" : "dice"} size={18} />
          {rolling
            ? "骰子滚动中…"
            : facesComplete
              ? "本掷已录入"
              : game.manual
                ? "随机填入"
                : game.turnPoints > 0 || game.held.length > 0
                  ? `重掷剩余 ${game.activeIds.length} 颗`
                  : `掷骰 ${game.activeIds.length} 颗`}
        </button>
        <button
          type="button"
          className={`button ghost ${game.manual ? "is-on" : ""}`}
          onClick={onManualToggle}
          disabled={rolling}
        >
          <Icon name="eye" size={16} />
          {game.manual ? (facesComplete ? "完成录入" : "录入中") : "手动录入"}
        </button>
      </div>

      <div className="round-score-row">
        <label className="round-score-control">
          <span>本回合已累计</span>
          <input
            type="number"
            min={0}
            step={50}
            value={game.turnPoints}
            onChange={(event) => onTurnPointsChange(Number(event.target.value) || 0)}
            disabled={rolling}
            aria-label="本回合已累计分数"
          />
        </label>
        <span className="round-score-hint">可修正</span>
      </div>

      {facesComplete && !noScore && (
        <div className="combo-board">
          <div className="combo-board-head">
            <div>
              <div className="eyebrow">TAKES · 可得分组合</div>
              <h3>按胜率排序</h3>
            </div>
            <button
              type="button"
              className="button ghost small"
              onClick={onClearSelection}
              disabled={!selectedPending}
            >
              重置选择
            </button>
          </div>
          <div className="combo-list">
            {comboRows.map((candidate, index) => {
              const isBest = index === 0;
              const isSelected =
                selectedKey ===
                candidate.diceIndices
                  .slice()
                  .sort((a, b) => a - b)
                  .join(",");
              return (
                <button
                  key={`${candidate.mask}-${candidate.nextState}-${candidate.score}`}
                  type="button"
                  className={`combo-row ${isBest ? "is-best" : ""} ${isSelected ? "is-selected" : ""}`}
                  onClick={() => onSelectRecommended(candidate.diceIndices)}
                  title="选中这个组合"
                >
                  <span className="combo-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="combo-info">
                    <span className="combo-name">{comboText(candidate.combos)}</span>
                    <span className="combo-tags">
                      {isBest && <span className="combo-tag is-gold">推荐</span>}
                      {candidate.score === maxScore && maxScore > (advice?.best?.score ?? 0) && (
                        <span className="combo-tag is-green">本次最高分</span>
                      )}
                      <span className="combo-tag">{candidate.action === "bank" ? "收手" : "续掷"}</span>
                    </span>
                  </span>
                  <span className="combo-numbers">
                    <strong>+{candidate.score}</strong>
                    <span>{pct(candidate.value)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="combo-board-hint">点组合选中 · 金框为胜率最高</p>
        </div>
      )}

      {facesComplete && !noScore && (
        <div className={`selection-panel ${selectedInvalid ? "is-invalid" : ""}`}>
          <div className="selection-head">
            <span className="selection-label">
              {selectedInvalid ? "这个组合不能得分" : selectedPending ? "你的选择" : "尚未选择"}
            </span>
            {selectedValid && advice?.selected && (
              <span className="selection-score">+{advice.selected.score.toLocaleString("zh-CN")} 分</span>
            )}
            {showRecommendedButton && (
              <button type="button" className="text-button" onClick={handleRecommended}>
                <Icon name="spark" size={14} /> 采用推荐选择
              </button>
            )}
          </div>
          {selectedValid && advice?.selected ? (
            <>
              <div className="selection-dice">
                {game.selected.map((id) => (
                  <DieMini
                    key={id}
                    face={game.faces[id]}
                    color={game.myDice[id]?.color}
                    label={`骰位 ${id + 1}`}
                  />
                ))}
              </div>
              <div className="combo-line">{comboText(advice.selected.combos)}</div>
            </>
          ) : selectedInvalid ? (
            <p className="invalid-hint">
              所选骰子无法全部计分。
            </p>
          ) : (
            <p className="muted-hint">
              未手动选择时使用推荐{advice?.best ? `（+${advice.best.score.toLocaleString("zh-CN")}）` : ""}。
            </p>
          )}
        </div>
      )}

      {facesComplete && noScore && (
        <div className="bust-panel">
          <div className="bust-icon">
            <Icon name="skull" size={22} />
          </div>
          <div>
            <strong>爆点</strong>
            <p>这掷没有任何可得分骰子，本回合累计 {game.turnPoints} 分会全部失去。</p>
          </div>
          <button type="button" className="button danger" onClick={onBust}>
            结束回合
          </button>
        </div>
      )}

      {facesComplete && !noScore && (
        <div className="action-grid">
          <button
            type="button"
            className={`action-card continue ${highlightContinue ? "is-best" : ""}`}
            onClick={handleContinue}
            disabled={actionDisabled || !continueTarget}
          >
            <span className="action-card-top">
              <span className="action-card-label">
                <Icon name="arrow" size={16} /> 拿走并续掷
              </span>
              {highlightContinue && <span className="best-tag">推荐</span>}
            </span>
            <span className="action-card-value">
              {continueTarget ? formatSigned(continueTarget.score) : "—"}
            </span>
            <span className="action-card-sub">
              剩余 {continueTarget?.nextActive.length ?? "—"} 颗 · 胜率 {pct(continueTarget?.continueValue)}
            </span>
          </button>

          <button
            type="button"
            className={`action-card bank ${highlightBank ? "is-best" : ""}`}
            onClick={handleBank}
            disabled={actionDisabled || !bankTarget}
          >
            <span className="action-card-top">
              <span className="action-card-label">
                <Icon name="coins" size={16} /> 收手
              </span>
              {highlightBank && <span className="best-tag">推荐</span>}
            </span>
            <span className="action-card-value">
              {bankTarget ? formatSigned(bankTarget.score) : "—"}
            </span>
            <span className="action-card-sub">
              本回合 {game.turnPoints + (bankTarget?.score ?? 0)} 分 · 胜率 {pct(bankTarget?.bankValue)}
            </span>
          </button>
        </div>
      )}

      <div className="board-watermark" aria-hidden="true">
        <Icon name="dice" size={190} />
      </div>

      <div className="board-extra">
        <div className="board-route">
          <div className="route-head">
            <span>本回合入账</span>
            <strong>+{game.turnPoints.toLocaleString("zh-CN")}</strong>
          </div>
          <div className="route-track">
            <span style={{ width: `${Math.min(100, (game.turnPoints / game.target) * 100)}%` }} />
          </div>
          <div className="route-meta">
            <span>起始胜率 {pct(startWin)}</span>
            <span>目标 {game.target.toLocaleString("zh-CN")}</span>
            <span>还差 {Math.max(0, game.target - game.myScore - game.turnPoints).toLocaleString("zh-CN")}</span>
          </div>
        </div>
        <div className="board-tip">
          <Icon name={tipAction === "bank" ? "coins" : "spark"} size={16} />
          <p>
            {tipAction === "bank"
              ? "领先或接近目标时，优先把分数锁进总分。一次爆点会吞掉整回合，而不是只丢一掷。"
              : tipAction === "continue"
                ? "落后时值得延长回合。KCD2 没有掷骰次数上限，但每一次续掷都要重新承担爆点风险。"
                : "KCD2 没有掷骰次数上限；每次续掷前，先比较爆点风险与目标差距，而不是只看当前分数。"}
          </p>
        </div>
      </div>
    </section>
  );
}