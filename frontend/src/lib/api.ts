import { format } from "date-fns"
import type { CalendarEvent } from "@/types"

export type SaveEventRequest = { title: string; start: string; end: string }

// Local wall-clock string, no timezone suffix. Matches what the backend stores.
export const toLocalString = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm:ss")

async function ensureOk(res: Response) {
  if (res.ok) return
  const text = (await res.text()).replace(/^"|"$/g, "")
  throw new Error(text || `Request failed (${res.status})`)
}

export async function getEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
  const res = await fetch(`/api/events?from=${toLocalString(from)}&to=${toLocalString(to)}`)
  await ensureOk(res)
  return res.json()
}

const json = { "Content-Type": "application/json" }

export async function createEvent(req: SaveEventRequest): Promise<void> {
  await ensureOk(await fetch("/api/events", { method: "POST", headers: json, body: JSON.stringify(req) }))
}

export async function updateEvent(id: number, req: SaveEventRequest): Promise<void> {
  await ensureOk(await fetch(`/api/events/${id}`, { method: "PUT", headers: json, body: JSON.stringify(req) }))
}

export async function deleteEvent(id: number): Promise<void> {
  await ensureOk(await fetch(`/api/events/${id}`, { method: "DELETE" }))
}