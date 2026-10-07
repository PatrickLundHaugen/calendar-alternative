import {
  addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday,
  parseISO, set, startOfDay, startOfMonth, startOfWeek,
} from "date-fns"
import { allowDrop, readDrag, startDrag } from "@/lib/dnd"
import type { CalendarEvent } from "@/types"

const MAX_CHIPS = 3
const W = { weekStartsOn: 1 as const }

type Props = {
  date: Date
  events: CalendarEvent[]
  onDayClick: (day: Date) => void
  onEventClick: (e: CalendarEvent) => void
  onShowWeek: (day: Date) => void
  onEventMove: (id: number, newStart: Date) => void
}

export function MonthView({ date, events, onDayClick, onEventClick, onShowWeek, onEventMove }: Props) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(date), W),
    end: endOfWeek(endOfMonth(date), W),
  })
  const rows = days.length / 7

  function handleDrop(ev: React.DragEvent, day: Date) {
    const payload = readDrag(ev)
    if (!payload) return
    ev.preventDefault()

    const moved = events.find((e) => e.id === payload.id)
    if (!moved) return

    // Same time of day, new date
    const t = parseISO(moved.start)
    onEventMove(payload.id, set(startOfDay(day), { hours: t.getHours(), minutes: t.getMinutes() }))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid grid-cols-7 border-b">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="py-2 text-center text-sm text-muted-foreground">
            {format(d, "EEE")}
          </div>
        ))}
      </div>

      <div
        className="grid min-h-0 flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {days.map((day) => {
          const dayStart = startOfDay(day)
          const dayEnd = addDays(dayStart, 1)
          const dayEvents = events.filter(
            (e) => parseISO(e.start) < dayEnd && parseISO(e.end) > dayStart
          )
          const hidden = dayEvents.length - MAX_CHIPS

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              onDragOver={allowDrop}
              onDrop={(ev) => handleDrop(ev, day)}
              className={`cursor-pointer overflow-hidden border-b border-l p-1 ${
                isSameMonth(day, date) ? "" : "bg-muted/40 text-muted-foreground"
              }`}
            >
              <div className={`mb-1 text-xs ${isToday(day) ? "font-semibold underline underline-offset-4" : ""}`}>
                {format(day, "d")}
              </div>

              {dayEvents.slice(0, MAX_CHIPS).map((e) => (
                <div
                  key={e.id}
                  draggable={isSameDay(parseISO(e.start), parseISO(e.end))}
                  onDragStart={(ev) => startDrag(ev, { id: e.id, offsetY: 0 })}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onEventClick(e)
                  }}
                  className="mb-0.5 truncate rounded bg-primary/10 px-1 text-xs text-foreground hover:bg-primary/20"
                >
                  {format(parseISO(e.start), "HH:mm")} {e.title}
                </div>
              ))}

              {hidden > 0 && (
                <button
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onShowWeek(day)
                  }}
                >
                  +{hidden} more
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}