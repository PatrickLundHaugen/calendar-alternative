export type CalendarEvent = {
  id: number
  title: string
  start: string // local time, e.g. "2026-10-07T18:00:00"
  end: string
  color: string | null
}

export type Slot = {
  start: string // local time, e.g. "2026-10-09T17:00:00"
  end: string
  matchesPreferences: boolean
}

export type ChatResponse = {
  reply: string
  title: string | null
  durationMinutes: number | null
  suggestions: Slot[]
  eventId: number | null
  suggestionSetId: number | null // id of the logged suggestions, sent back when one is confirmed
}