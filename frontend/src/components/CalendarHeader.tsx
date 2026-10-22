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
    // "@container" makes the layout follow the width of the calendar card, not the screen,
    // so it also adapts when the assistant panel is open.
    <div className="@container border-b border-border/60 px-4 py-3 md:px-6 md:py-5">
      {/* Narrow: a 2x2 grid. Wide: one row, reordered with the order classes. */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-y-3 @3xl:flex @3xl:gap-3">
        <div className="flex items-center gap-1 @3xl:order-2">
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

        <div className="flex items-center gap-2 justify-self-end @3xl:order-4">
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <Button size="icon" onClick={onNew} aria-label="New event" className="@3xl:hidden">
            <Plus />
          </Button>
          <Button onClick={onNew} className="hidden @3xl:inline-flex">
            <Plus /> New event
          </Button>
        </div>

        <div className="flex min-w-0 items-center gap-3 @3xl:order-1 @3xl:mr-auto">
          <h1 className="truncate text-lg font-semibold tracking-tight @3xl:text-2xl">{title}</h1>
          {badge && (
            <span className="hidden shrink-0 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground @md:inline-block">
              {badge}
            </span>
          )}
        </div>

        <div className="flex h-10 items-stretch justify-self-end rounded-full border bg-card p-1 @3xl:order-3">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange(v)}
              className={`rounded-full px-3 text-sm capitalize transition-colors ${
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}