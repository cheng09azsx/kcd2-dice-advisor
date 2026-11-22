import type { SVGProps } from "react";

export type IconName =
  | "settings"
  | "undo"
  | "close"
  | "dice"
  | "shield"
  | "chevron"
  | "info"
  | "check"
  | "arrow"
  | "coins"
  | "rotate"
  | "trash"
  | "copy"
  | "skull"
  | "crown"
  | "target"
  | "user"
  | "bot"
  | "spark"
  | "lock"
  | "eye";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {name === "settings" && (
        <>
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </>
      )}
      {name === "undo" && (
        <>
          <path d="M9 7 4 12l5 5" />
          <path d="M4 12h9a6 6 0 0 1 6 6v1" />
        </>
      )}
      {name === "close" && <path d="m6 6 12 12M18 6 6 18" />}
      {name === "dice" && (
        <>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
        </>
      )}
      {name === "shield" && (
        <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
      )}
      {name === "chevron" && <path d="m6 9 6 6 6-6" />}
      {name === "info" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <circle cx="12" cy="8" r=".8" fill="currentColor" stroke="none" />
        </>
      )}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "arrow" && <path d="M5 12h14m-5-5 5 5-5 5" />}
      {name === "coins" && (
        <>
          <ellipse cx="9" cy="7" rx="5" ry="2.5" />
          <path d="M4 7v5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7" />
          <path d="M10 16.5c.7 1.5 2.6 2.5 5 2.5 2.8 0 5-1.1 5-2.5v-5" />
          <ellipse cx="15" cy="11.5" rx="5" ry="2.5" />
        </>
      )}
      {name === "rotate" && (
        <>
          <path d="M20 8v5h-5" />
          <path d="M19 13a7.5 7.5 0 1 1-2.2-5.3L20 11" />
        </>
      )}
      {name === "trash" && (
        <>
          <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
          <path d="M10 11v5M14 11v5" />
        </>
      )}
      {name === "copy" && (
        <>
          <rect x="8" y="8" width="11" height="12" rx="2" />
          <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
        </>
      )}
      {name === "skull" && (
        <>
          <path d="M5 11a7 7 0 1 1 14 0c0 2.2-1.2 3.4-2.5 4.3V18h-2v2h-5v-2H7.5v-2.7C6.2 14.4 5 13.2 5 11Z" />
          <circle cx="9.2" cy="11" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="14.8" cy="11" r="1.1" fill="currentColor" stroke="none" />
        </>
      )}
      {name === "crown" && (
        <path d="m4 8 4 3 4-6 4 6 4-3-2 11H6L4 8Z" />
      )}
      {name === "target" && (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none" />
        </>
      )}
      {name === "user" && (
        <>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c.8-4 3.4-6 7-6s6.2 2 7 6" />
        </>
      )}
      {name === "bot" && (
        <>
          <rect x="4" y="7" width="16" height="12" rx="3" />
          <path d="M12 3v4M8 13h.01M16 13h.01M8 16h8" />
        </>
      )}
      {name === "spark" && (
        <>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      )}
      {name === "lock" && (
        <>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </>
      )}
      {name === "eye" && (
        <>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.8" />
        </>
      )}
    </svg>
  );
}
