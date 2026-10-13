import { useEffect, useMemo, useState } from "react"
import {
  addDays, addHours, addMinutes, addMonths, differenceInMinutes, endOfMonth, endOfWeek, format,
  isSameDay, parseISO, set, startOfDay, startOfHour, startOfMonth, startOfWeek,
} from "date-fns"
import { CalendarHeader, type View } from "@/components/CalendarHeader"
import { EventDialog } from "@/components/EventDialog"
import { MonthView } from "@/components/MonthView"
import { WeekView } from "@/components/WeekView"
import { createEvent, deleteEvent, getEvents, toLocalString, updateEvent } from "@/lib/api"
import { draftToRequest, eventToDraft, newDraft, type EventDraft } from "@/lib/draft"
import type { CalendarEvent } from "@/types"
import { ChatPanel } from "@/components/ChatPanel"

const W = { weekStartsOn: 1 as const }

// The date range the current view needs from the API: [from, to)
function getRange(view: View, date: Date) {
  if (view === "week") {
    const from = startOfWeek(date, W)
    return { from, to: addDays(from, 7) }
  }
  return {
    from: startOfWeek(startOfMonth(date), W),
    to: addDays(startOfWeek(endOfMonth(date), W), 7),
  }
}

export default function App() {
  const [view, setView] = useState<View>("week")
  const [date, setDate] = useState(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [rescheduleTarget, setRescheduleTarget] = useState<CalendarEvent | null>(null)

  const { from, to } = useMemo(() => getRange(view, date), [view, date])

  useEffect(() => {
    let cancelled = false
    setError(null)
    getEvents(from, to)
      .then((data) => { if (!cancelled) setEvents(data) })
      .catch((e) => { if (!cancelled) setError(String(e.message ?? e)) })
    return () => { cancelled = true }
  }, [from, to, reloadKey])

  const reload = () => setReloadKey((k) => k + 1)

  async function handleSave(d: EventDraft) {
    const req = draftToRequest(d)
    if (d.id !== undefined) await updateEvent(d.id, req)
    else await createEvent(req)
    reload()
  }

  async function handleDelete(id: number) {
    await deleteEvent(id)
    reload()
  }

  function handleScheduled(start: Date) {
    setDate(start) // jump to the week or month of the new event
    reload()
  }

  async function handleMove(id: number, newStart: Date) {
    const ev = events.find((e) => e.id === id)
    if (!ev) return

    const oldStart = parseISO(ev.start)
    const minutes = differenceInMinutes(parseISO(ev.end), oldStart)

    let start = newStart
    let end = addMinutes(start, minutes)
    if (!isSameDay(start, end)) {
      // Keep the event inside one day: end at 23:59 and shift the start earlier
      end = set(start, { hours: 23, minutes: 59, seconds: 0, milliseconds: 0 })
      start = addMinutes(end, -minutes)
    }
    if (start.getTime() === oldStart.getTime()) return

    const moved = { ...ev, start: toLocalString(start), end: toLocalString(end) }

    // Optimistic update: show the move immediately
    setEvents((list) => list.map((e) => (e.id === id ? moved : e)))
    try {
      await updateEvent(id, { title: moved.title, start: moved.start, end: moved.end })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      reload() // roll back to what the server has
    }
  }

  const step = (dir: 1 | -1) =>
    setDate((d) => (view === "week" ? addDays(d, 7 * dir) : addMonths(d, dir)))

  const label =
    view === "week"
      ? `Week ${format(from, "I")}: ${format(from, "d MMM")} - ${format(endOfWeek(date, W), "d MMM yyyy")}`
      : format(date, "MMMM yyyy")

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <CalendarHeader
          label={label}
          view={view}
          onViewChange={setView}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onNew={() => setDraft(newDraft(startOfHour(addHours(new Date(), 1))))}
        />
        {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}

        <div className="min-h-0 flex-1">
          {view === "week" ? (
            <WeekView
              weekStart={from}
              events={events}
              onSlotClick={(start) => setDraft(newDraft(start))}
              onEventClick={(e) => setDraft(eventToDraft(e))}
              onEventMove={handleMove}
            />
          ) : (
            <MonthView
              date={date}
              events={events}
              onDayClick={(day) => setDraft(newDraft(addHours(startOfDay(day), 9)))}
              onEventClick={(e) => setDraft(eventToDraft(e))}
              onShowWeek={(day) => { setDate(day); setView("week") }}
              onEventMove={handleMove}
            />
          )}
        </div>
      </div>

      <ChatPanel
        target={rescheduleTarget}
        onClearTarget={() => setRescheduleTarget(null)}
        onScheduled={handleScheduled}
      />

      <EventDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onSave={handleSave}
        onDelete={handleDelete}
        onReschedule={(id) => setRescheduleTarget(events.find((e) => e.id === id) ?? null)}
      />
    </div>
  )
}