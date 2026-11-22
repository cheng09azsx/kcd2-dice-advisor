export function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatScore(value: number): string {
  return Math.round(value).toLocaleString("zh-CN");
}

export function formatSigned(value: number): string {
  if (value > 0) return `+${formatScore(value)}`;
  return formatScore(value);
}

export function points(value: number): string {
  return `${formatScore(value)} 分`;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function safePct(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function faceText(faces: readonly number[]): string {
  return faces.join(" · ");
}
