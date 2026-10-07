import { addMinutes, format, isSameDay, parseISO } from "date-fns"
import type { SaveEventRequest } from "@/lib/api"
import type { CalendarEvent } from "@/types"

// What the form edits. Plain strings match the <input type="date"> and <input type="time"> values.
export type EventDraft = {
  id?: number
  title: string
  date: string // yyyy-MM-dd
  startTime: string // HH:mm
  endTime: string // HH:mm
}

// A new one-hour draft starting at the given moment (capped at 23:59)
export function newDraft(start: Date): EventDraft {
  let end = addMinutes(start, 60)
  if (!isSameDay(start, end)) {
    end = new Date(start)
    end.setHours(23, 59, 0, 0)
  }
  return {
    title: "",
    date: format(start, "yyyy-MM-dd"),
    startTime: format(start, "HH:mm"),
    endTime: format(end, "HH:mm"),
  }
}

export function eventToDraft(e: CalendarEvent): EventDraft {
  const start = parseISO(e.start)
  const end = parseISO(e.end)
  return {
    id: e.id,
    title: e.title,
    date: format(start, "yyyy-MM-dd"),
    startTime: format(start, "HH:mm"),
    endTime: format(end, "HH:mm"),
  }
}

export function draftToRequest(d: EventDraft): SaveEventRequest {
  return {
    title: d.title.trim(),
    start: `${d.date}T${d.startTime}:00`,
    end: `${d.date}T${d.endTime}:00`,
  }
}