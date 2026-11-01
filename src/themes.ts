export const THEME_IDS = ["green", "blue", "purple", "teal", "orange"] as const;
export type Theme = typeof THEME_IDS[number];
export const THEME_KEY = "carbontrace.theme.v1";

let currentTheme: Theme = "green";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEME_IDS.some((theme) => theme === value);
}

export function getTheme(): Theme {
  return currentTheme;
}

export function setTheme(theme: Theme): void {
  if (!isTheme(theme)) throw new Error("Unsupported interface theme.");
  currentTheme = theme;
}
