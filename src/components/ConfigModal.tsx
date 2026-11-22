import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { DieSpec, FaceProbs } from "../core/dice";
import {
  DICE_PRESETS,
  PRESET_BY_ID,
  QUICK_SETS,
  customDie,
  dieFromPreset,
  quickSetDice,
} from "../core/dice";
import { effectiveTarget } from "../core/game";
import { Modal } from "./Modal";
import { Pips } from "./Dice";
import { Icon } from "./Icon";

export type ConfigTab = "match" | "my" | "opp" | "rules";

export interface ConfigValues {
  target: number;
  myScore: number;
  oppScore: number;
  myDice: DieSpec[];
  oppDice: DieSpec[];
}

export interface ConfigModalProps {
  open: boolean;
  initialTab?: ConfigTab;
  values: ConfigValues;
  onClose: () => void;
  onApply: (values: ConfigValues) => void;
}

const TABS: { id: ConfigTab; label: string; icon: "target" | "dice" | "bot" | "shield" }[] = [
  { id: "match", label: "对局", icon: "target" },
  { id: "my", label: "我的骰子", icon: "dice" },
  { id: "opp", label: "对手骰子", icon: "bot" },
  { id: "rules", label: "规则", icon: "shield" },
];

function clone(dice: DieSpec[]): DieSpec[] {
  return dice.map((die) => ({ ...die, probs: [...die.probs] as FaceProbs }));
}

function percentText(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function ProbabilityBars({ probs, color }: { probs: readonly number[]; color: string }) {
  return (
    <div className="prob-bars" aria-hidden="true">
      {probs.map((p, index) => (
        <span className="prob-bar" key={index} title={`${index + 1} 点：${percentText(p)}`}>
          <span className="prob-bar-fill" style={{ height: `${Math.max(3, p * 100)}%`, background: color }} />
          <span className="prob-bar-face">{index + 1}</span>
        </span>
      ))}
    </div>
  );
}

function topFace(probs: readonly number[]): { face: number; p: number } {
  let best = 0;
  for (let i = 1; i < probs.length; i += 1) if (probs[i] > probs[best]) best = i;
  return { face: best + 1, p: probs[best] };
}

interface DiceEditorProps {
  side: "my" | "opp";
  dice: DieSpec[];
  onChange: (dice: DieSpec[]) => void;
  otherDice: DieSpec[];
}

function DiceEditor({ side, dice, onChange, otherDice }: DiceEditorProps) {
  const [editing, setEditing] = useState<number | null>(null);

  const applyPreset = (slot: number, presetId: string) => {
    if (presetId === "custom") {
      setEditing(slot);
      return;
    }
    const preset = PRESET_BY_ID.get(presetId);
    if (!preset) return;
    const next = dice.slice();
    next[slot] = dieFromPreset(preset, slot);
    onChange(next);
    setEditing(null);
  };

  const applyCustom = (slot: number, probs: FaceProbs) => {
    const next = dice.slice();
    next[slot] = customDie(slot, probs);
    onChange(next);
    setEditing(null);
  };

  const applyQuickSet = (presetIds: string[]) => {
    const next = presetIds.map((id, index) => {
      const preset = PRESET_BY_ID.get(id) ?? DICE_PRESETS[0];
      return dieFromPreset(preset, index);
    });
    onChange(next);
    setEditing(null);
  };

  const copyOther = () => {
    onChange(clone(otherDice));
    setEditing(null);
  };

  return (
    <div className="dice-editor">
      <div className="editor-toolbar">
        <div>
          <h3>{side === "my" ? "你的 6 颗骰子" : "对手的 6 颗骰子"}</h3>
          <p>每颗骰子可以不同。选择预设，或微调六个面的概率。</p>
        </div>
        <button type="button" className="button ghost small" onClick={copyOther}>
          <Icon name="copy" size={14} /> 复制{side === "my" ? "对手" : "我方"}骰组
        </button>
      </div>

      <div className="quick-sets">
        <span className="quick-sets-label">快速套组</span>
        {QUICK_SETS.map((set) => (
          <button
            key={set.id}
            type="button"
            className="quick-chip"
            title={set.subtitle}
            onClick={() => applyQuickSet(set.presetIds)}
          >
            {set.name}
          </button>
        ))}
      </div>

      <div className="slot-list">
        {dice.map((die, slot) => {
          const preset = die.presetId ? PRESET_BY_ID.get(die.presetId) : null;
          const top = topFace(die.probs);
          return (
            <div className={`slot-row ${editing === slot ? "is-editing" : ""}`} key={die.id}>
              <span className="slot-index">{String(slot + 1).padStart(2, "0")}</span>
              <span className="slot-die-preview" style={{ "--die-accent": die.color } as CSSProperties}>
                <Pips face={top.face} />
              </span>
              <div className="slot-main">
                <div className="slot-select-line">
                  <select
                    className="die-select"
                    value={die.presetId ?? "custom"}
                    onChange={(event) => applyPreset(slot, event.target.value)}
                    aria-label={`第 ${slot + 1} 颗骰子的预设`}
                  >
                    {!die.presetId && <option value="custom">自定义概率</option>}
                    {(["基础", "灌铅", "恶魔", "圣物", "牙齿"] as const).map((category) => (
                      <optgroup key={category} label={category}>
                        {DICE_PRESETS.filter((p) => p.category === category).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {p.en}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <span className="slot-top-face">
                    主面 {top.face} · {percentText(top.p)}
                  </span>
                  <button
                    type="button"
                    className="text-button slot-edit-button"
                    onClick={() => setEditing(editing === slot ? null : slot)}
                  >
                    {editing === slot ? "收起" : "微调概率"}
                  </button>
                </div>
                <div className="slot-detail-line">
                  <ProbabilityBars probs={die.probs} color={die.color} />
                  <div className="slot-note">
                    <span className="slot-color-dot" style={{ background: die.color }} />
                    {preset
                      ? preset.note ??
                        (preset.id === "ordinary" ? "标准均匀六面骰" : "预设概率分布")
                      : "自定义概率分布"}
                    {die.effectNote && <em> · {die.effectNote}</em>}
                  </div>
                </div>
                {editing === slot && (
                  <CustomProbabilityEditor
                    die={die}
                    onApply={(probs) => applyCustom(slot, probs)}
                    onCancel={() => setEditing(null)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomProbabilityEditor({
  die,
  onApply,
  onCancel,
}: {
  die: DieSpec;
  onApply: (probs: FaceProbs) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<string[]>(
    die.probs.map((p) => (p * 100).toFixed(1)),
  );
  const numbers = values.map((value) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  const sum = numbers.reduce((a, b) => a + b, 0);
  const normalized = sum > 0 ? numbers.map((n) => n / sum) : numbers;

  const update = (index: number, value: string) => {
    const next = values.slice();
    next[index] = value;
    setValues(next);
  };

  const average = () => {
    setValues(Array.from({ length: 6 }, () => (100 / 6).toFixed(1)));
  };

  return (
    <div className="custom-editor">
      <div className="custom-editor-head">
        <span>自定义六面概率（会自动归一化）</span>
        <button type="button" className="text-button" onClick={average}>
          平均分配
        </button>
      </div>
      <div className="custom-grid">
        {values.map((value, index) => (
          <label key={index} className="custom-field">
            <span>{index + 1} 点</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={value}
              onChange={(event) => update(index, event.target.value)}
            />
            <span className="custom-normalized">{percentText(normalized[index] ?? 0)}</span>
          </label>
        ))}
      </div>
      <div className="custom-editor-foot">
        <span className={`sum-indicator ${Math.abs(sum - 100) > 0.5 ? "is-warn" : ""}`}>
          合计 {sum.toFixed(1)}%
        </span>
        <div>
          <button type="button" className="button ghost small" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="button primary small"
            onClick={() => onApply(normalized as FaceProbs)}
            disabled={sum <= 0}
          >
            应用
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchEditor({
  targetText,
  myScoreText,
  oppScoreText,
  setTargetText,
  setMyScoreText,
  setOppScoreText,
}: {
  targetText: string;
  myScoreText: string;
  oppScoreText: string;
  setTargetText: (value: string) => void;
  setMyScoreText: (value: string) => void;
  setOppScoreText: (value: string) => void;
}) {
  return (
    <div className="match-editor">
      <div className="form-row">
        <label className="form-field">
          <span>目标分</span>
          <input
            type="number"
            min={50}
            max={10000}
            step={50}
            value={targetText}
            onChange={(event) => setTargetText(event.target.value)}
          />
          <small>先达到目标分者获胜；KCD2 常见 2000。</small>
        </label>
      </div>
      <div className="form-grid">
        <label className="form-field">
          <span>你的分数</span>
          <input
            type="number"
            min={0}
            step={50}
            value={myScoreText}
            onChange={(event) => setMyScoreText(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>对手分数</span>
          <input
            type="number"
            min={0}
            step={50}
            value={oppScoreText}
            onChange={(event) => setOppScoreText(event.target.value)}
          />
        </label>
      </div>
      <div className="form-note">
        <Icon name="info" size={15} />
        应用比分后，当前回合会重新开始。所有分数按 50 分结算，输入不是 50 的倍数时会自动取整。
      </div>
      <div className="match-presets">
        <button type="button" className="quick-chip" onClick={() => { setMyScoreText("0"); setOppScoreText("0"); }}>
          0 : 0
        </button>
        <button type="button" className="quick-chip" onClick={() => { setMyScoreText("1000"); setOppScoreText("800"); }}>
          1000 : 800
        </button>
        <button type="button" className="quick-chip" onClick={() => { setMyScoreText("1500"); setOppScoreText("1200"); }}>
          1500 : 1200
        </button>
      </div>
    </div>
  );
}

function RulesContent() {
  return (
    <div className="rules-content">
      <section>
        <h3>计分</h3>
        <div className="score-grid">
          <div><span>单 1</span><strong>100</strong></div>
          <div><span>单 5</span><strong>50</strong></div>
          <div><span>三条 1</span><strong>1,000</strong></div>
          <div><span>三条 2-6</span><strong>点数 × 100</strong></div>
          <div><span>四条</span><strong>三条 × 2</strong></div>
          <div><span>五条</span><strong>三条 × 4</strong></div>
          <div><span>六条</span><strong>三条 × 8</strong></div>
          <div><span>小顺 1-5</span><strong>500</strong></div>
          <div><span>大顺 2-6</span><strong>750</strong></div>
          <div><span>全顺 1-6</span><strong>1,500</strong></div>
        </div>
        <p className="rules-callout">三对子（如 1-1-2-2-3-3）在 KCD2 中<strong>不计分</strong>；不要按普通 Farkle 规则误选。</p>
      </section>
      <section>
        <h3>回合</h3>
        <ul>
          <li>每回合先掷 6 颗骰子；每次至少要拿走一组能得分的骰子。</li>
          <li>KCD2 <strong>没有掷骰次数上限</strong>：可以一直续掷，直到主动收手或爆点。</li>
          <li>爆点会失去本回合累计的<strong>全部</strong>分数，但不会扣总分。</li>
          <li>如果 6 颗骰子全部拿走并得分，骰子全部回到场上，可以继续掷（热骰）。</li>
          <li>收手后本回合分数进入总分；先达到目标分者获胜。</li>
        </ul>
      </section>
      <section>
        <h3>特殊骰</h3>
        <p>
          首版把特殊骰建模为<strong>逐面非均匀概率</strong>。你可以为双方各配置 6 颗不同骰子，内置 KCD2 全骰预设。
        </p>
        <p className="rules-callout">
          魔鬼头颅骰的万能面、徽章、改点等“非概率”效果尚未计入。魔鬼头颅预设当前只按普通六面概率计算。
        </p>
      </section>
      <section>
        <h3>胜率算法</h3>
        <p>
          先按双方骰组的逐面概率给出快速估算，界面立即可用；随后在后台求解双方最优的精确博弈：每个剩余分数状态都枚举所有合法拿法，并比较“续掷 / 收手”，直到千分之一容差收敛。精确结果出来后会自动替换，并标注「精确博弈」。
        </p>
        <p>
          推荐层再加一道自动风险预算：<b>B = clamp(8% + max(0, 最佳续掷胜率 - 最佳收手胜率), 8%, 35%)</b>。下一掷爆点超过 B 时自动收手；续掷优势越大，允许的风险越高。这是约束 MDP 的 ε-约束，不需要手动挡位。
        </p>
        <p>
          骰子按概率签名分组加速；六颗骰子完全不同、目标分过大等复杂情况会保留快速估算，避免长时间等待。胜率是模型估计，不是游戏内定值；未计入徽章、万能骰等特殊效果。
        </p>
      </section>
    </div>
  );
}

export function ConfigModal({
  open,
  initialTab = "match",
  values,
  onClose,
  onApply,
}: ConfigModalProps) {
  const [tab, setTab] = useState<ConfigTab>(initialTab);
  const [targetText, setTargetText] = useState(String(values.target));
  const [myScoreText, setMyScoreText] = useState(String(values.myScore));
  const [oppScoreText, setOppScoreText] = useState(String(values.oppScore));
  const [myDice, setMyDice] = useState<DieSpec[]>(() => clone(values.myDice));
  const [oppDice, setOppDice] = useState<DieSpec[]>(() => clone(values.oppDice));

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setTargetText(String(values.target));
    setMyScoreText(String(values.myScore));
    setOppScoreText(String(values.oppScore));
    setMyDice(clone(values.myDice));
    setOppDice(clone(values.oppDice));
  }, [open, initialTab, values.target, values.myScore, values.oppScore, values.myDice, values.oppDice]);

  const targetNumber = Number(targetText);
  const scoreNumber = Number(myScoreText);
  const oppNumber = Number(oppScoreText);
  const invalid =
    !Number.isFinite(targetNumber) ||
    targetNumber < 50 ||
    !Number.isFinite(scoreNumber) ||
    !Number.isFinite(oppNumber) ||
    scoreNumber < 0 ||
    oppNumber < 0;

  const summary = useMemo(() => {
    const target = effectiveTarget(targetNumber || 2000);
    return `目标 ${target} · 你 ${Math.max(0, scoreNumber || 0)} · 对手 ${Math.max(0, oppNumber || 0)}`;
  }, [targetNumber, scoreNumber, oppNumber]);

  const apply = () => {
    if (invalid) return;
    onApply({
      target: effectiveTarget(targetNumber),
      myScore: Math.max(0, Math.round(scoreNumber / 50) * 50),
      oppScore: Math.max(0, Math.round(oppNumber / 50) * 50),
      myDice,
      oppDice,
    });
  };

  const resetDefaults = () => {
    const ordinary = PRESET_BY_ID.get("ordinary")!;
    setMyDice(Array.from({ length: 6 }, (_, index) => dieFromPreset(ordinary, index)));
    setOppDice(Array.from({ length: 6 }, (_, index) => dieFromPreset(ordinary, index)));
    setTargetText("2000");
    setMyScoreText("0");
    setOppScoreText("0");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="对局与骰组"
      eyebrow="SETUP · 设置"
      wide
      footer={
        <>
          <button type="button" className="button ghost" onClick={resetDefaults}>
            <Icon name="rotate" size={15} /> 恢复默认
          </button>
          <div className="modal-foot-right">
            <span className="modal-summary">{summary}</span>
            <button type="button" className="button ghost" onClick={onClose}>
              取消
            </button>
            <button type="button" className="button primary" onClick={apply} disabled={invalid}>
              <Icon name="check" size={15} /> 应用设置
            </button>
          </div>
        </>
      }
    >
      <div className="config-tabs" role="tablist" aria-label="设置分类">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`config-tab ${tab === item.id ? "is-active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            <Icon name={item.icon} size={15} />
            {item.label}
          </button>
        ))}
      </div>

      <div className="config-content">
        {tab === "match" && (
          <MatchEditor
            targetText={targetText}
            myScoreText={myScoreText}
            oppScoreText={oppScoreText}
            setTargetText={setTargetText}
            setMyScoreText={setMyScoreText}
            setOppScoreText={setOppScoreText}
          />
        )}
        {tab === "my" && (
          <DiceEditor side="my" dice={myDice} onChange={setMyDice} otherDice={oppDice} />
        )}
        {tab === "opp" && (
          <DiceEditor side="opp" dice={oppDice} onChange={setOppDice} otherDice={myDice} />
        )}
        {tab === "rules" && <RulesContent />}
      </div>
    </Modal>
  );
}
