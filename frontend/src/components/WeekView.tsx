import { useEffect, useRef } from "react"
import {
  addDays, addMinutes, differenceInMinutes, format, isSameDay, isToday, max, min, parseISO, startOfDay,
} from "date-fns"
import { allowDrop, readDrag, startDrag } from "@/lib/dnd"
import type { CalendarEvent } from "@/types"

const HOUR_HEIGHT = 48 // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const GRID = "grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]"
const SNAP_MINUTES = 15

type Props = {
  weekStart: Date
  events: CalendarEvent[]
  onSlotClick: (start: Date) => void
  onEventClick: (e: CalendarEvent) => void
  onEventMove: (id: number, newStart: Date) => void
}

export function WeekView({ weekStart, events, onSlotClick, onEventClick, onEventMove }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`${GRID} border-b`}>
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className="py-2 text-center text-sm">
            <div className="text-muted-foreground">{format(d, "EEE")}</div>
            <div className={isToday(d) ? "font-semibold underline underline-offset-4" : ""}>
              {format(d, "d")}
            </div>
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className={GRID}>
          <div>
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
          {days.map((d) => (
            <DayColumn
              key={d.toISOString()}
              day={d}
              events={events}
              onSlotClick={onSlotClick}
              onEventClick={onEventClick}
              onEventMove={onEventMove}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

type ColumnProps = {
  day: Date
  events: CalendarEvent[]
  onSlotClick: (start: Date) => void
  onEventClick: (e: CalendarEvent) => void
  onEventMove: (id: number, newStart: Date) => void
}

function DayColumn({ day, events, onSlotClick, onEventClick, onEventMove }: ColumnProps) {
  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)

  const dayEvents = events.filter(
    (e) => parseISO(e.start) < dayEnd && parseISO(e.end) > dayStart
  )

  function handleClick(ev: React.MouseEvent<HTMLDivElement>) {
    const rect = ev.currentTarget.getBoundingClientRect()
    const halfHours = Math.floor(((ev.clientY - rect.top) / HOUR_HEIGHT) * 2)
    onSlotClick(addMinutes(dayStart, halfHours * 30))
  }

  function handleDrop(ev: React.DragEvent<HTMLDivElement>) {
    const payload = readDrag(ev)
    if (!payload) return
    ev.preventDefault()

    // Top edge of the dragged event = pointer position minus the grab offset
    const rect = ev.currentTarget.getBoundingClientRect()
    const minutes = ((ev.clientY - rect.top - payload.offsetY) / HOUR_HEIGHT) * 60
    const snapped = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES
    const clamped = Math.min(Math.max(snapped, 0), 24 * 60 - SNAP_MINUTES)
    onEventMove(payload.id, addMinutes(dayStart, clamped))
  }

  return (
    <div
      className={`relative cursor-pointer border-l ${isToday(day) ? "bg-muted/40" : ""}`}
      style={{ height: 24 * HOUR_HEIGHT }}
      onClick={handleClick}
      onDragOver={allowDrop}
      onDrop={handleDrop}
    >
      {HOURS.map((h) => (
        <div key={h} className="border-b" style={{ height: HOUR_HEIGHT }} />
      ))}

      {dayEvents.map((e) => {
        const start = max([parseISO(e.start), dayStart])
        const end = min([parseISO(e.end), dayEnd])
        const top = (differenceInMinutes(start, dayStart) / 60) * HOUR_HEIGHT
        const height = Math.max((differenceInMinutes(end, start) / 60) * HOUR_HEIGHT, 20)
        const draggable = isSameDay(parseISO(e.start), parseISO(e.end))

        return (
          <div
            key={e.id}
            draggable={draggable}
            onDragStart={(ev) => {
              const rect = ev.currentTarget.getBoundingClientRect()
              startDrag(ev, { id: e.id, offsetY: ev.clientY - rect.top })
            }}
            className="absolute inset-x-0.5 overflow-hidden rounded-md border bg-primary/10 px-1.5 py-0.5 text-xs hover:bg-primary/20"
            style={{ top, height }}
            onClick={(ev) => {
              ev.stopPropagation()
              onEventClick(e)
            }}
          >
            <div className="truncate font-medium">{e.title}</div>
            <div className="truncate text-muted-foreground">
              {format(start, "HH:mm")} - {format(end, "HH:mm")}
            </div>
          </div>
        )
      })}
    </div>
  )
}