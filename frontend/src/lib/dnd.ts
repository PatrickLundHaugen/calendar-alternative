import type React from "react"

// Custom type so we only react to our own drags, not files or text dragged from elsewhere
export const DRAG_TYPE = "application/x-calendar-event"

export type DragPayload = {
  id: number
  offsetY: number // pixels between the top of the event and where the user grabbed it
}

export function startDrag(ev: React.DragEvent, payload: DragPayload) {
  ev.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload))
  ev.dataTransfer.effectAllowed = "move"
}

export function readDrag(ev: React.DragEvent): DragPayload | null {
  const raw = ev.dataTransfer.getData(DRAG_TYPE)
  return raw ? (JSON.parse(raw) as DragPayload) : null
}

// The browser only allows a drop if dragover calls preventDefault().
// During dragover the data itself is hidden, but the list of types is readable.
export function allowDrop(ev: React.DragEvent) {
  if (ev.dataTransfer.types.includes(DRAG_TYPE)) {
    ev.preventDefault()
    ev.dataTransfer.dropEffect = "move"
  }
}