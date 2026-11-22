import type { CSSProperties } from "react";
import type { DieSpec } from "../core/dice";
import { Icon } from "./Icon";

const PIP_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Pips({ face, className = "" }: { face: number; className?: string }) {
  const active = new Set(PIP_POSITIONS[face] ?? []);
  return (
    <span className={`pips ${className}`} aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={`pip-slot ${active.has(i) ? "on" : ""} ${
            face === 1 || face === 4 ? "red" : ""
          }`}
        >
          {active.has(i) && <span className="pip" />}
        </span>
      ))}
    </span>
  );
}

export interface DieCardProps {
  die: DieSpec;
  face: number | null;
  selected?: boolean;
  held?: boolean;
  disabled?: boolean;
  rolling?: boolean;
  onClick?: () => void;
  index: number;
}

export function DieCard({
  die,
  face,
  selected = false,
  held = false,
  disabled = false,
  rolling = false,
  onClick,
  index,
}: DieCardProps) {
  const style = {
    "--die-accent": die.color,
    "--die-delay": `${index * 35}ms`,
  } as CSSProperties;

  const content = (
    <>
      <span className="die-corner die-corner-tl" />
      <span className="die-corner die-corner-br" />
      {face ? (
        <Pips face={face} />
      ) : (
        <span className="die-empty">
          <Icon name="dice" size={24} />
          <span>?</span>
        </span>
      )}
      {selected && (
        <span className="die-check">
          <Icon name="check" size={12} />
        </span>
      )}
      {held && <span className="die-held-label">已拿走</span>}
    </>
  );

  const className = [
    "die-card",
    selected ? "is-selected" : "",
    held ? "is-held" : "",
    disabled ? "is-disabled" : "",
    rolling ? "is-rolling" : "",
    !face ? "is-face-down" : "",
    die.effectNote ? "is-special" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (onClick && !disabled) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        onClick={onClick}
        title={`${die.name}（骰位 ${index + 1}）`}
        aria-label={`${die.name}，${face ? `${face} 点` : "尚未掷出"}${selected ? "，已选中" : ""}`}
        aria-pressed={selected}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={className}
      style={style}
      title={die.name}
      role="img"
      aria-label={`${die.name}，${face ? `${face} 点` : "尚未掷出"}${held ? "，已拿走" : ""}`}
    >
      {content}
    </div>
  );
}

export function DieMini({
  face,
  color,
  dim = false,
  label,
}: {
  face: number;
  color?: string;
  dim?: boolean;
  label?: string;
}) {
  return (
    <span
      className={`die-mini ${dim ? "is-dim" : ""}`}
      style={{ "--die-accent": color ?? "#c9a45c" } as CSSProperties}
      title={label}
    >
      <Pips face={face} />
    </span>
  );
}

export function FacePicker({
  die,
  face,
  onChange,
  disabled,
}: {
  die: DieSpec;
  face: number | null;
  onChange: (face: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="face-picker" style={{ "--die-accent": die.color } as CSSProperties}>
      <div className="face-picker-head">
        <span className="face-picker-dot" />
        <span>{die.name}</span>
      </div>
      <div className="face-picker-grid">
        {[1, 2, 3, 4, 5, 6].map((value) => (
          <button
            key={value}
            type="button"
            className={`face-button ${face === value ? "is-active" : ""}`}
            onClick={() => onChange(value)}
            disabled={disabled}
            aria-label={`设为 ${value} 点`}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}
