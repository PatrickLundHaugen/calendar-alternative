import { Sparkles } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { EventDraft } from "@/lib/draft"
import { COLORS, COLOR_KEYS, colorForTitle } from "@/lib/colors"

type Props = {
  draft: EventDraft | null
  onClose: () => void
  onSave: (d: EventDraft) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onReschedule: (id: number) => void
}

export function EventDialog({ draft, onClose, onSave, onDelete, onReschedule }: Props) {
  return (
    <Dialog open={draft !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent showCloseButton={false}>
        {draft && (
          <EventForm draft={draft} onClose={onClose} onSave={onSave} onDelete={onDelete} onReschedule={onReschedule} />
        )}
      </DialogContent>
    </Dialog>
  )
}

// Mounted only while the dialog is open, so its state resets every time it opens
function EventForm({ draft, onClose, onSave, onDelete, onReschedule }: Omit<Props, "draft"> & { draft: EventDraft }) {
  const [form, setForm] = useState<EventDraft>(draft)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (patch: Partial<EventDraft>) => setForm((f) => ({ ...f, ...patch }))
  const activeColor = form.color ?? colorForTitle(form.title)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return setError("Title is required.")
    if (form.endTime <= form.startTime) return setError("End must be after start.")
    run(() => onSave(form))
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader className="flex-row items-center justify-between space-y-0 text-left">
        <DialogTitle>{form.id ? "Edit event" : "New event"}</DialogTitle>
        {form.id !== undefined && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Reschedule with AI"
            aria-label="Reschedule with AI"
            disabled={busy}
            onClick={() => {
              onReschedule(form.id!)
              onClose()
            }}
          >
            <Sparkles />
          </Button>
        )}
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" autoFocus value={form.title} onChange={(e) => set({ title: e.target.value })} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="start">Start</Label>
          <Input id="start" type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="end">End</Label>
          <Input id="end" type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-label={key}
              aria-pressed={activeColor === key}
              onClick={() => set({ color: key })}
              className={`size-7 rounded-full ring-offset-2 ring-offset-background transition ${COLORS[key].swatch} ${
                activeColor === key ? "ring-2 ring-foreground" : "hover:scale-110"
              }`}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        {form.id !== undefined && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={busy}
            onClick={() => run(() => onDelete(form.id!))}
          >
            Delete
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Save
          </Button>
        </div>
      </div>
    </form>
  )
}