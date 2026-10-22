import { useEffect, useRef, useState } from "react"
import {
  addDays, addMinutes, differenceInMinutes, format, isSameDay, isToday, max, min, parseISO, startOfDay,
} from "date-fns"
import { COLORS, resolveColor } from "@/lib/colors"
import { DRAG_THRESHOLD_PX } from "@/lib/dnd"
import { useNow } from "@/lib/useNow"
import type { CalendarEvent } from "@/types"

const HOUR_HEIGHT = 56 // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const GRID = "grid grid-cols-[3.5rem_repeat(7,minmax(4.75rem,1fr))]"
const SNAP_MINUTES = 15
const COMPACT_BELOW_PX = 44 // shorter cards show title and time on one line
const EDGE_PX = 48 // dragging this close to the top or bottom edge scrolls the grid
const MAX_SCROLL_STEP = 14 // pixels per frame at the very edge

// What the preview shows while an event is being dragged
type DragState = { id: number; dayIndex: number; startMin: number; durationMin: number }
// Bookkeeping for the press that may turn into a drag (not rendered, so a ref)
type DragInfo = {
  id: number
  startX: number
  startY: number
  offsetY: number
  durationMin: number
  moved: boolean
}

type Props = {
  weekStart: Date
  events: CalendarEvent[]
  onSlotClick: (start: Date) => void
  onEventClick: (e: CalendarEvent) => void
  onEventMove: (id: number, newStart: Date) => void
}

export function WeekView({ weekStart, events, onSlotClick, onEventClick, onEventMove }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const now = useNow()
  const scrollRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const columnRefs = useRef<(HTMLDivElement | null)[]>([])
  const dragInfo = useRef<DragInfo | null>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null) // last pointer position while dragging
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragging = drag !== null

  // Start two hours before the current time
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(new Date().getHours() - 2, 0) * HOUR_HEIGHT
    }
  }, [])

  function cancelDrag() {
    dragInfo.current = null
    pointer.current = null
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

  // Which column and which 15 minute slot is the pointer over? The card is snapped to it.
  function positionFor(clientX: number, clientY: number, info: DragInfo) {
    // Keep the whole card inside the visible part of the grid, below the sticky day row.
    // Without this the preview would disappear when the pointer is over the header.
    let y = clientY
    const scroller = scrollRef.current
    if (scroller) {
      const rect = scroller.getBoundingClientRect()
      const visibleTop = rect.top + (headerRef.current?.offsetHeight ?? 0)
      const cardHeight = (info.durationMin / 60) * HOUR_HEIGHT
      const minY = visibleTop + info.offsetY
      const maxY = Math.max(minY, rect.bottom - (cardHeight - info.offsetY))
      y = Math.min(Math.max(clientY, minY), maxY)
    }

    let dayIndex = 0
    columnRefs.current.forEach((el, i) => {
      if (el && clientX >= el.getBoundingClientRect().left) dayIndex = i
    })
    const top = columnRefs.current[dayIndex]?.getBoundingClientRect().top ?? 0
    const rawMinutes = ((y - top - info.offsetY) / HOUR_HEIGHT) * 60
    const snapped = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES
    const startMin = Math.min(Math.max(snapped, 0), 24 * 60 - info.durationMin)
    return { dayIndex, startMin }
  }

  function updateDrag(clientX: number, clientY: number, info: DragInfo) {
    const { dayIndex, startMin } = positionFor(clientX, clientY, info)
    setDrag((prev) =>
      prev && prev.dayIndex === dayIndex && prev.startMin === startMin
        ? prev // same slot, nothing to re-render
        : { id: info.id, dayIndex, startMin, durationMin: info.durationMin }
    )
  }

  // Scroll the grid while the pointer is near (or beyond) its top or bottom edge
  useEffect(() => {
    if (!dragging) return
    let frame = 0
    const tick = () => {
      const p = pointer.current
      const info = dragInfo.current
      const scroller = scrollRef.current
      if (p && info && scroller) {
        const rect = scroller.getBoundingClientRect()
        const top = rect.top + (headerRef.current?.offsetHeight ?? 0)
        let step = 0
        if (p.y < top + EDGE_PX) {
          step = -Math.min((top + EDGE_PX - p.y) / EDGE_PX, 1) * MAX_SCROLL_STEP
        } else if (p.y > rect.bottom - EDGE_PX) {
          step = Math.min((p.y - (rect.bottom - EDGE_PX)) / EDGE_PX, 1) * MAX_SCROLL_STEP
        }
        if (step !== 0) {
          scroller.scrollTop += step
          updateDrag(p.x, p.y, info) // the slot under the pointer changed because the grid moved
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [dragging])

  function handlePointerDown(ev: React.PointerEvent<HTMLDivElement>, e: CalendarEvent) {
    if (ev.button !== 0) return
    ev.currentTarget.setPointerCapture(ev.pointerId) // keep receiving events even outside the card
    dragInfo.current = {
      id: e.id,
      startX: ev.clientX,
      startY: ev.clientY,
      offsetY: ev.clientY - ev.currentTarget.getBoundingClientRect().top,
      durationMin: differenceInMinutes(parseISO(e.end), parseISO(e.start)),
      moved: false,
    }
  }

  function handlePointerMove(ev: React.PointerEvent<HTMLDivElement>) {
    const info = dragInfo.current
    if (!info) return
    if (!info.moved && Math.hypot(ev.clientX - info.startX, ev.clientY - info.startY) < DRAG_THRESHOLD_PX) return

    info.moved = true
    pointer.current = { x: ev.clientX, y: ev.clientY }
    updateDrag(ev.clientX, ev.clientY, info)
  }

  function handlePointerUp(ev: React.PointerEvent<HTMLDivElement>, e: CalendarEvent) {
    const info = dragInfo.current
    dragInfo.current = null
    pointer.current = null
    if (!info) return // cancelled with Escape
    if (!info.moved) {
      onEventClick(e) // a click, not a drag
      return
    }
    const { dayIndex, startMin } = positionFor(ev.clientX, ev.clientY, info)
    setDrag(null)
    onEventMove(e.id, addMinutes(startOfDay(days[dayIndex]), startMin))
  }

  return (
    // One scroll container for both directions, so the day row can stick to the top
    // and the time column to the left while the week scrolls sideways on small screens.
    <div ref={scrollRef} className="h-full overflow-auto">
      <div className="min-w-[37rem]">
        <div
          ref={headerRef}
          className={`${GRID} sticky top-0 z-30 border-b border-border/60 bg-card`}
        >
          <div className="sticky left-0 z-10 bg-card" />
          {days.map((d) => (
            <div key={d.toISOString()} className="py-2 text-center md:py-3">
              <div className="text-xs text-muted-foreground">{format(d, "EEE")}</div>
              <div
                className={`mx-auto mt-1 flex size-8 items-center justify-center rounded-full text-sm ${
                  isToday(d) ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {format(d, "d")}
              </div>
            </div>
          ))}
        </div>

        <div className={GRID}>
          <div className="sticky left-0 z-20 bg-card">
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT }}
                className="pr-2 text-right text-xs text-muted-foreground"
              >
                {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>
          {days.map((d, i) => (
            <DayColumn
              key={d.toISOString()}
              day={d}
              index={i}
              now={now}
              events={events}
              drag={drag}
              setRef={(el) => {
                columnRefs.current[i] = el
              }}
              onSlotClick={onSlotClick}
              onEventClick={onEventClick}
              onCardDown={handlePointerDown}
              onCardMove={handlePointerMove}
              onCardUp={handlePointerUp}
              onCardCancel={cancelDrag}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

type ColumnProps = {
  day: Date
  index: number
  now: Date
  events: CalendarEvent[]
  drag: DragState | null
  setRef: (el: HTMLDivElement | null) => void
  onSlotClick: (start: Date) => void
  onEventClick: (e: CalendarEvent) => void
  onCardDown: (ev: React.PointerEvent<HTMLDivElement>, e: CalendarEvent) => void
  onCardMove: (ev: React.PointerEvent<HTMLDivElement>) => void
  onCardUp: (ev: React.PointerEvent<HTMLDivElement>, e: CalendarEvent) => void
  onCardCancel: () => void
}

function DayColumn({
  day, index, now, events, drag, setRef, onSlotClick, onEventClick,
  onCardDown, onCardMove, onCardUp, onCardCancel,
}: ColumnProps) {
  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)
  const today = isToday(day)

  const dayEvents = events.filter(
    (e) => parseISO(e.start) < dayEnd && parseISO(e.end) > dayStart
  )
  // The dragged event, if its preview is currently in this column
  const ghostEvent = drag && drag.dayIndex === index ? events.find((e) => e.id === drag.id) : undefined

  function handleClick(ev: React.MouseEvent<HTMLDivElement>) {
    const rect = ev.currentTarget.getBoundingClientRect()
    const halfHours = Math.floor(((ev.clientY - rect.top) / HOUR_HEIGHT) * 2)
    onSlotClick(addMinutes(dayStart, halfHours * 30))
  }

  return (
    <div
      ref={setRef}
      className={`relative cursor-pointer border-l border-border/60 ${today ? "bg-muted/40" : ""}`}
      style={{ height: 24 * HOUR_HEIGHT }}
      onClick={handleClick}
    >
      {HOURS.map((h) => (
        <div key={h} className="border-b border-border/60" style={{ height: HOUR_HEIGHT }} />
      ))}

      {dayEvents.map((e) => {
        const start = max([parseISO(e.start), dayStart])
        const end = min([parseISO(e.end), dayEnd])
        const top = (differenceInMinutes(start, dayStart) / 60) * HOUR_HEIGHT
        const height = Math.max((differenceInMinutes(end, start) / 60) * HOUR_HEIGHT, 20)
        const cardHeight = height - 2
        const compact = cardHeight < COMPACT_BELOW_PX
        const draggable = isSameDay(parseISO(e.start), parseISO(e.end))
        const color = COLORS[resolveColor(e)]
        const time = `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`

        return (
          <div
            key={e.id}
            onPointerDown={draggable ? (ev) => onCardDown(ev, e) : undefined}
            onPointerMove={draggable ? onCardMove : undefined}
            onPointerUp={draggable ? (ev) => onCardUp(ev, e) : undefined}
            onPointerCancel={draggable ? onCardCancel : undefined}
            onClick={(ev) => {
              ev.stopPropagation() // never also trigger the column's "new event" click
              if (!draggable) onEventClick(e)
            }}
            className={`absolute inset-x-1 select-none overflow-hidden rounded-card px-2 text-xs transition-colors ${
              compact ? "" : "py-1"
            } ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${
              drag?.id === e.id ? "opacity-40" : ""
            } ${color.card}`}
            style={{ top: top + 1, height: cardHeight }}
          >
            {compact ? (
              <div className="flex h-full items-center gap-2">
                <span className="min-w-0 truncate font-medium">{e.title}</span>
                <span className="min-w-0 shrink-[3] truncate opacity-70">{time}</span>
              </div>
            ) : (
              <>
                <div className="truncate font-medium">{e.title}</div>
                <div className="truncate opacity-70">{time}</div>
              </>
            )}
          </div>
        )
      })}

      {/* Live preview while dragging: snapped to this column and to 15 minute steps */}
      {drag && ghostEvent && (
        <div
          className={`pointer-events-none absolute inset-x-1 z-20 overflow-hidden rounded-card px-2 py-1 text-xs shadow-lg ring-2 ring-primary ${
            COLORS[resolveColor(ghostEvent)].card
          }`}
          style={{
            top: (drag.startMin / 60) * HOUR_HEIGHT + 1,
            height: (drag.durationMin / 60) * HOUR_HEIGHT - 2,
          }}
        >
          <div className="truncate font-medium">{ghostEvent.title}</div>
          <div className="truncate opacity-70">
            {format(addMinutes(dayStart, drag.startMin), "HH:mm")} -{" "}
            {format(addMinutes(dayStart, drag.startMin + drag.durationMin), "HH:mm")}
          </div>
        </div>
      )}

      {/* Now-line: the line and the dot are both centered on the same point */}
      {today && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10"
          style={{ top: (differenceInMinutes(now, dayStart) / 60) * HOUR_HEIGHT }}
        >
          <div className="absolute inset-x-0 top-0 h-0.5 -translate-y-1/2 bg-now" />
          <div className="absolute left-0 top-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-now" />
        </div>
      )}
    </div>
  )
}