import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { EventDraft } from "@/lib/draft"

type Props = {
  draft: EventDraft | null
  onClose: () => void
  onSave: (d: EventDraft) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

export function EventDialog({ draft, onClose, onSave, onDelete }: Props) {
  return (
    <Dialog open={draft !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        {draft && <EventForm draft={draft} onClose={onClose} onSave={onSave} onDelete={onDelete} />}
      </DialogContent>
    </Dialog>
  )
}

// Mounted only while the dialog is open, so its state resets every time it opens
function EventForm({ draft, onClose, onSave, onDelete }: Omit<Props, "draft"> & { draft: EventDraft }) {
  const [form, setForm] = useState<EventDraft>(draft)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (patch: Partial<EventDraft>) => setForm((f) => ({ ...f, ...patch }))

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
      <DialogHeader>
        <DialogTitle>{form.id ? "Edit event" : "New event"}</DialogTitle>
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        {form.id !== undefined && (
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => run(() => onDelete(form.id!))}
          >
            Delete
          </Button>
        )}
        <Button type="button" variant="outline" className="ml-auto" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          Save
        </Button>
      </div>
    </form>
  )
}