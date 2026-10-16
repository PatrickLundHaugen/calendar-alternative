export type EventColor = "blue" | "teal" | "green" | "amber" | "orange" | "rose" | "violet" | "slate"

type Style = { card: string; swatch: string }

export const COLORS: Record<EventColor, Style> = {
  blue: {
    card: "bg-blue-300 text-blue-950 hover:bg-blue-400 dark:bg-blue-500/80 dark:text-white dark:hover:bg-blue-500",
    swatch: "bg-blue-300 dark:bg-blue-500",
  },
  teal: {
    card: "bg-teal-300 text-teal-950 hover:bg-teal-400 dark:bg-teal-500/80 dark:text-white dark:hover:bg-teal-500",
    swatch: "bg-teal-300 dark:bg-teal-500",
  },
  green: {
    card: "bg-green-300 text-green-950 hover:bg-green-400 dark:bg-green-500/80 dark:text-white dark:hover:bg-green-500",
    swatch: "bg-green-300 dark:bg-green-500",
  },
  amber: {
    card: "bg-amber-300 text-amber-950 hover:bg-amber-400 dark:bg-amber-500/80 dark:text-amber-950 dark:hover:bg-amber-500",
    swatch: "bg-amber-300 dark:bg-amber-500",
  },
  orange: {
    card: "bg-orange-300 text-orange-950 hover:bg-orange-400 dark:bg-orange-500/80 dark:text-white dark:hover:bg-orange-500",
    swatch: "bg-orange-300 dark:bg-orange-500",
  },
  rose: {
    card: "bg-rose-300 text-rose-950 hover:bg-rose-400 dark:bg-rose-500/80 dark:text-white dark:hover:bg-rose-500",
    swatch: "bg-rose-300 dark:bg-rose-500",
  },
  violet: {
    card: "bg-violet-300 text-violet-950 hover:bg-violet-400 dark:bg-violet-500/80 dark:text-white dark:hover:bg-violet-500",
    swatch: "bg-violet-300 dark:bg-violet-500",
  },
  slate: {
    card: "bg-slate-300 text-slate-950 hover:bg-slate-400 dark:bg-slate-500/80 dark:text-white dark:hover:bg-slate-500",
    swatch: "bg-slate-300 dark:bg-slate-500",
  },
}

export const COLOR_KEYS = Object.keys(COLORS) as EventColor[]

// Colors given automatically. Slate (gray) is only for people who pick it on purpose.
const AUTO_KEYS = COLOR_KEYS.filter((k) => k !== "slate")

// The same title always gives the same color
export function colorForTitle(title: string): EventColor {
  let hash = 0
  for (const ch of title.trim().toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AUTO_KEYS[hash % AUTO_KEYS.length]
}

export function isEventColor(value: string | null | undefined): value is EventColor {
  return !!value && value in COLORS
}

// The stored color if there is a valid one, otherwise derived from the title
export function resolveColor(e: { color?: string | null; title: string }): EventColor {
  return isEventColor(e.color) ? e.color : colorForTitle(e.title)
}