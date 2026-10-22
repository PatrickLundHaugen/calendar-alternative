import { useEffect, useRef, useState } from "react"
import {
  addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday,
  parseISO, set, startOfDay, startOfMonth, startOfWeek,
} from "date-fns"
import { COLORS, resolveColor } from "@/lib/colors"
import { DRAG_THRESHOLD_PX } from "@/lib/dnd"
import type { CalendarEvent } from "@/types"

const MAX_CHIPS = 3
const W = { weekStartsOn: 1 as const }

type DragState = { id: number; day: string } // day as yyyy-MM-dd, the cell under the pointer

// How events are shown in a day cell, depending on the size of the cell
type Mode = "inline" | "stacked" | "dots"

type Props = {
  date: Date
  events: CalendarEvent[]
  onDayClick: (day: Date) => void
  onEventClick: (e: CalendarEvent) => void
  onShowWeek: (day: Date) => void
  onEventMove: (id: number, newStart: Date) => void
}

// The day cell under the pointer. Every cell carries a data-day attribute.
function dayAt(x: number, y: number): string | null {
  return document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-day]")?.dataset.day ?? null
}

export function MonthView({ date, events, onDayClick, onEventClick, onShowWeek, onEventMove }: Props) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(date), W),
    end: endOfWeek(endOfMonth(date), W),
  })
  const rows = days.length / 7

  const gridRef = useRef<HTMLDivElement>(null)
  const dragInfo = useRef<{ startX: number; startY: number; moved: boolean } | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [layout, setLayout] = useState({ narrow: false, short: false })
  const dragging = drag !== null

  // Measure the cells, so the content can adapt to phones and to the assistant panel being open
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const measure = () => {
      const next = { narrow: el.clientWidth / 7 < 96, short: el.clientHeight / rows < 70 }
      setLayout((prev) => (prev.narrow === next.narrow && prev.short === next.short ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [rows])

  const mode: Mode = !layout.narrow ? "inline" : layout.short ? "dots" : "stacked"

  function cancelDrag() {
    dragInfo.current = null
    setDrag(null)
  }

  // Escape cancels a drag in progress
  useEffect(() => {
    if (!dragging) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDrag()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dragging])

  function handlePointerDown(ev: React.PointerEvent<HTMLDivElement>) {
    if (ev.button !== 0) return
    ev.currentTarget.setPointerCapture(ev.pointerId)
    dragInfo.current = { startX: ev.clientX, startY: ev.clientY, moved: false }
  }

  function handlePointerMove(ev: React.PointerEvent<HTMLDivElement>, e: CalendarEvent) {
    const info = dragInfo.current
    if (!info) return
    if (!info.moved && Math.hypot(ev.clientX - info.startX, ev.clientY - info.startY) < DRAG_THRESHOLD_PX) return

    info.moved = true
    const day = dayAt(ev.clientX, ev.clientY)
    setDrag((prev) => (!day ? null : prev && prev.day === day ? prev : { id: e.id, day }))
  }

  function handlePointerUp(ev: React.PointerEvent<HTMLDivElement>, e: CalendarEvent) {
    const info = dragInfo.current
    dragInfo.current = null
    if (!info) return // cancelled with Escape
    if (!info.moved) {
      onEventClick(e) // a click, not a drag
      return
    }
    const day = dayAt(ev.clientX, ev.clientY)
    setDrag(null)
    if (!day) return

    // Same time of day, new date
    const t = parseISO(e.start)
    onEventMove(e.id, set(startOfDay(parseISO(day)), { hours: t.getHours(), minutes: t.getMinutes() }))
  }

  // One chip. The ghost is the preview that shows where a dragged event will land.
  function renderChip(e: CalendarEvent, ghost = false) {
    const draggable = isSameDay(parseISO(e.start), parseISO(e.end))
    const time = format(parseISO(e.start), "HH:mm")
    const size =
      mode === "stacked"
        ? "w-full shrink-0 overflow-hidden rounded-card px-1 py-0.5 text-[10px] leading-3"
        : "mb-1 truncate rounded-card px-2 py-0.5 text-xs"
    const isDragged = !ghost && drag?.id === e.id
    const lifted = isDragged && drag?.day === format(parseISO(e.start), "yyyy-MM-dd")
    const away = isDragged && !lifted

    return (
      <div
        key={ghost ? `ghost-${e.id}` : e.id}
        onPointerDown={!ghost && draggable ? handlePointerDown : undefined}
        onPointerMove={!ghost && draggable ? (ev) => handlePointerMove(ev, e) : undefined}
        onPointerUp={!ghost && draggable ? (ev) => handlePointerUp(ev, e) : undefined}
        onPointerCancel={!ghost && draggable ? cancelDrag : undefined}
        onClick={(ev) => {
          ev.stopPropagation()
          if (!draggable) onEventClick(e)
        }}
        className={`select-none transition-colors ${size} ${COLORS[resolveColor(e)].card} ${
          ghost || lifted ? "shadow-lg ring-2 ring-primary" : ""
        } ${ghost ? "pointer-events-none" : "cursor-grab active:cursor-grabbing"} ${
          away ? "invisible" : ""
        }`}
      >
        {mode === "stacked" ? (
          <>
            <div className="truncate opacity-70">{time}</div>
            <div className="truncate font-medium">{e.title}</div>
          </>
        ) : (
          <>
            {time} {e.title}
          </>
        )}
      </div>
    )
  }

  const dragged = drag ? events.find((e) => e.id === drag.id) : undefined
  const dragSource = dragged ? format(parseISO(dragged.start), "yyyy-MM-dd") : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid grid-cols-7 border-b border-border/60">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="py-3 text-center text-xs text-muted-foreground">
            {format(d, "EEE")}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        className="grid min-h-0 flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {days.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd")
          const dayStart = startOfDay(day)
          const dayEnd = addDays(dayStart, 1)
          const dayEvents = events.filter(
            (e) => parseISO(e.start) < dayEnd && parseISO(e.end) > dayStart
          )
          const hidden = dayEvents.length - MAX_CHIPS
          const ghost = dragged && drag?.day === dayKey && dragSource !== dayKey ? renderChip(dragged, true) : null

          return (
            <div
              key={dayKey}
              data-day={dayKey}
              // Narrow cells: tapping a day opens that week. Wider cells: new event.
              onClick={() => (layout.narrow ? onShowWeek(day) : onDayClick(day))}
              className={`flex min-h-0 cursor-pointer flex-col overflow-hidden border-b border-l border-border/60 ${
                layout.narrow ? "p-1" : "p-1.5"
              } ${isSameMonth(day, date) ? "" : "bg-muted/40 text-muted-foreground"}`}
            >
              <div
                className={`mb-1 flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                  isToday(day) ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {format(day, "d")}
              </div>

              {mode === "dots" && (
                <div className="flex flex-wrap gap-0.5">
                  {dayEvents.slice(0, 6).map((e) => (
                    <span key={e.id} className={`size-1.5 rounded-full ${COLORS[resolveColor(e)].swatch}`} />
                  ))}
                </div>
              )}

              {/* Chips that do not fit wrap into a second column, which is clipped.
                  That way only whole chips are ever shown. */}
              {mode === "stacked" && (
                <div className="flex min-h-0 flex-1 flex-col flex-wrap gap-y-1 overflow-hidden">
                  {ghost}
                  {dayEvents.map((e) => renderChip(e))}
                </div>
              )}

              {mode === "inline" && (
                <div className="min-h-0">
                  {ghost}
                  {dayEvents.slice(0, MAX_CHIPS).map((e) => renderChip(e))}
                  {hidden > 0 && (
                    <button
                      className="px-2 text-xs text-muted-foreground hover:underline"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        onShowWeek(day)
                      }}
                    >
                      +{hidden} more
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}