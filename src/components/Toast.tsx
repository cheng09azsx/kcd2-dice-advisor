import { Icon } from "./Icon";

export type ToastTone = "good" | "bad" | "gold" | "neutral";

export function Toast({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: ToastTone;
}) {
  return (
    <div className={`toast is-${tone}`} role="status" aria-live="polite">
      <span className="toast-icon">
        <Icon
          name={tone === "bad" ? "skull" : tone === "gold" ? "spark" : tone === "good" ? "check" : "info"}
          size={16}
        />
      </span>
      <span>{text}</span>
    </div>
  );
}
