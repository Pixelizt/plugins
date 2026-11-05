// client.yaml brand → src/styles/tokens.css (generated, git-ignored).
// The ONLY place brand values become CSS. Components use the tokens, never raw values.
import type { ClientConfig } from "./schema.ts";

type Brand = ClientConfig["brand"];

const SHADOW_MIX: Record<Brand["shadow"], [number, number, number]> = { none: [0, 0, 0], soft: [6, 8, 10], strong: [12, 16, 22] };
/** Elevation tokens tinted with the brand's foreground color, so shadows match light or dark palettes. */
export function shadows(level: Brand["shadow"]): Record<"sm" | "md" | "lg", string> {
  if (level === "none") return { sm: "none", md: "none", lg: "none" };
  const [a, b, c] = SHADOW_MIX[level];
  const tint = (p: number) => `color-mix(in oklab, var(--foreground) ${p}%, transparent)`;
  return {
    sm: `0 1px 2px ${tint(a)}`,
    md: `0 4px 12px -2px ${tint(b)}, 0 2px 4px -2px ${tint(a)}`,
    lg: `0 16px 40px -8px ${tint(c)}, 0 6px 12px -6px ${tint(b)}`,
  };
}

export const RADIUS: Record<Brand["radius"], string> = {
  none: "0px",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "1rem",
  full: "9999px",
};

function rgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio between two hex colors (1 to 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pick whichever of the brand's foreground/background reads best on `bg`. */
export function onColor(bg: string, fg: string, bgBase: string): string {
  return contrast(bg, fg) >= contrast(bg, bgBase) ? fg : bgBase;
}

export interface TokenResult {
  css: string;
  warnings: string[];
}

export function buildTokens(brand: Brand): TokenResult {
  const c = brand.colors;
  const pairs: Record<string, string> = {
    primary: onColor(c.primary, c.foreground, c.background),
    secondary: onColor(c.secondary, c.foreground, c.background),
    accent: onColor(c.accent, c.foreground, c.background),
    muted: onColor(c.muted, c.foreground, c.background),
  };

  const warnings: string[] = [];
  const check = (name: string, fg: string, bg: string, min = 4.5) => {
    const r = contrast(fg, bg);
    if (r < min) warnings.push(`${name}: contrast ${r.toFixed(2)}:1 is below ${min}:1 (WCAG AA)`);
  };
  check("foreground on background", c.foreground, c.background);
  for (const [k, fg] of Object.entries(pairs)) check(`text on ${k}`, fg, c[k as keyof typeof c]);

  const lines = [
    "/* GENERATED from client.yaml → brand by src/kit/config/tokens.ts. Do not edit: change client.yaml. */",
    ":root {",
    `  --background: ${c.background};`,
    `  --foreground: ${c.foreground};`,
    ...Object.keys(pairs).flatMap((k) => [
      `  --${k}: ${c[k as keyof typeof c]};`,
      `  --${k}-foreground: ${pairs[k]};`,
    ]),
    `  --muted-text: color-mix(in oklab, var(--foreground) 65%, var(--background));`,
    `  --border: color-mix(in oklab, var(--foreground) 14%, var(--background));`,
    `  --ring: var(--primary);`,
    `  --radius: ${RADIUS[brand.radius]};`,
    ...Object.entries(shadows(brand.shadow)).map(([k, v]) => `  --kit-shadow-${k}: ${v};`),
    "}",
    "",
  ];
  return { css: lines.join("\n"), warnings };
}
