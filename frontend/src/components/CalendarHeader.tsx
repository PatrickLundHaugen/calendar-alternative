import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export type View = "week" | "month"

type Props = {
  label: string
  view: View
  onViewChange: (v: View) => void
  onPrev: () => void
  onNext: () => void
  onNew: () => void
}

export function CalendarHeader({ label, view, onViewChange, onPrev, onNext, onNew }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
      <Button variant="outline" size="icon" onClick={onPrev} aria-label="Previous">
        <ChevronLeft />
      </Button>
      <Button variant="outline" size="icon" onClick={onNext} aria-label="Next">
        <ChevronRight />
      </Button>
      <h1 className="ml-2 text-lg font-semibold">{label}</h1>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex rounded-md border p-0.5">
          {(["week", "month"] as const).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={view === v ? "secondary" : "ghost"}
              onClick={() => onViewChange(v)}
              className="capitalize"
            >
              {v}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={onNew}>
          <Plus /> New event
        </Button>
      </div>
    </div>
  )
}