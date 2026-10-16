import { ChevronLeft, ChevronRight, Moon, Plus, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Theme } from "@/lib/theme"

export type View = "week" | "month"

type Props = {
  title: string
  badge?: string
  view: View
  onViewChange: (v: View) => void
  onPrev: () => void
  onToday: () => void
  onNext: () => void
  onNew: () => void
  theme: Theme
  onToggleTheme: () => void
}

export function CalendarHeader({
  title, badge, view, onViewChange, onPrev, onToday, onNext, onNew, theme, onToggleTheme,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-5 py-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrev} aria-label="Previous">
          <ChevronLeft />
        </Button>
        <Button variant="outline" onClick={onToday}>
          Today
        </Button>
        <Button variant="outline" size="icon" onClick={onNext} aria-label="Next">
          <ChevronRight />
        </Button>
      </div>

      <div className="ml-1 flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {badge && (
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{badge}</span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex h-10 items-stretch rounded-full border bg-card p-1">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange(v)}
              className={`rounded-full px-4 text-sm capitalize transition-colors ${
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
        <Button onClick={onNew}>
          <Plus /> New event
        </Button>
      </div>
    </div>
  )
}