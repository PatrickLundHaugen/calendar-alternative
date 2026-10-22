import { useEffect, useMemo, useState } from "react"
import {
  addDays, addHours, addMinutes, addMonths, differenceInMinutes, endOfMonth, isSameMonth, isSameYear, format,
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
import { useTheme } from "@/lib/theme"

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
  const { theme, toggle: toggleTheme } = useTheme()
  const [view, setView] = useState<View>("week")
  const [date, setDate] = useState(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [rescheduleTarget, setRescheduleTarget] = useState<CalendarEvent | null>(null)
  const [chatOpen, setChatOpenState] = useState(() => localStorage.getItem("chatOpen") === "true")

  const { from, to } = useMemo(() => getRange(view, date), [view, date])

  function setChatOpen(open: boolean) {
    localStorage.setItem("chatOpen", String(open)) // remembered between visits
    setChatOpenState(open)
  }

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

  const weekEnd = addDays(from, 6)
  const title =
    view === "month"
      ? format(date, "MMMM yyyy")
      : isSameMonth(from, weekEnd)
        ? format(from, "MMMM yyyy")
        : isSameYear(from, weekEnd)
          ? `${format(from, "MMM")} - ${format(weekEnd, "MMM yyyy")}`
          : `${format(from, "MMM yyyy")} - ${format(weekEnd, "MMM yyyy")}`
  const badge = view === "week" ? `Week ${format(from, "I")}` : undefined

  return (
    <div className="flex h-dvh flex-col bg-background md:flex-row">
      <main className="m-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card shadow-sm">
        <CalendarHeader
          title={title}
          badge={badge}
          view={view}
          onViewChange={setView}
          onPrev={() => step(-1)}
          onToday={() => setDate(new Date())}
          onNext={() => step(1)}
          onNew={() => setDraft(newDraft(startOfHour(addHours(new Date(), 1))))}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        {error && <p className="px-5 py-2 text-sm text-destructive">{error}</p>}

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
      </main>

      <ChatPanel
        open={chatOpen}
        onOpenChange={setChatOpen}
        target={rescheduleTarget}
        onClearTarget={() => setRescheduleTarget(null)}
        onScheduled={handleScheduled}
      />

      <EventDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onSave={handleSave}
        onDelete={handleDelete}
        onReschedule={(id) => {
          setRescheduleTarget(events.find((e) => e.id === id) ?? null)
          setChatOpen(true) // make sure the assistant is visible
        }}
      />
    </div>
  )
}