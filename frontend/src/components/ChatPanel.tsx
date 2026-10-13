import { useEffect, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { Check, RotateCw, SendHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createEvent, sendChat, toLocalString, updateEvent } from "@/lib/api"
import type { CalendarEvent, Slot } from "@/types"

type Message =
  | { id: number; role: "user"; text: string }
  | {
      id: number
      role: "assistant"
      text: string
      error?: boolean
      title?: string
      eventId?: number // set when the suggestions move an existing event
      slots?: Slot[]
      chosen?: number // index of the slot the user confirmed
      retry?: { text: string; history: string[]; targetId?: number } // set on failed requests
    }

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

const WELCOME: Message = {
  id: 0,
  role: "assistant",
  text: 'Tell me what you need to do and I will find time for it. For example: "Find me two hours to study Java this week, preferably in the evening."',
}

type Props = {
  target: CalendarEvent | null // event selected for rescheduling
  onClearTarget: () => void
  onScheduled: (start: Date) => void
}

export function ChatPanel({ target, onClearTarget, onScheduled }: Props) {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const nextId = useRef(1)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, busy])

  // When an event is selected for rescheduling, jump straight to typing
  useEffect(() => {
    if (target) inputRef.current?.focus()
  }, [target])

  const add = (m: DistributiveOmit<Message, "id">) =>
    setMessages((list) => [...list, { ...m, id: nextId.current++ } as Message])

  const fail = (e: unknown) =>
    add({ role: "assistant", text: e instanceof Error ? e.message : String(e), error: true })

  async function ask(text: string, history: string[], targetId?: number) {
    setBusy(true)
    try {
      const r = await sendChat(text, targetId, history)
      add({
        role: "assistant",
        text: r.reply,
        title: r.title ?? undefined,
        eventId: r.eventId ?? undefined,
        slots: r.suggestions,
      })
    } catch (err) {
      add({
        role: "assistant",
        text: err instanceof Error ? err.message : String(err),
        error: true,
        retry: { text, history, targetId }, // remembered so the button can repeat it
      })
    } finally {
      setBusy(false)
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return

    // Your messages since the last confirmed suggestion, at most 4. Assistant replies are not sent.
    const lastConfirmed = messages.findLastIndex((m) => m.role === "assistant" && m.chosen !== undefined)
    const history = messages
      .slice(lastConfirmed + 1)
      .filter((m) => m.role === "user")
      .map((m) => m.text)
      .slice(-4)

    setInput("")
    add({ role: "user", text })
    await ask(text, history, target?.id)
  }

  function retry(messageId: number) {
    const msg = messages.find((m) => m.id === messageId)
    if (busy || !msg || msg.role !== "assistant" || !msg.retry) return

    const { text, history, targetId } = msg.retry
    // Remove the button from the old error so it cannot be pressed twice
    setMessages((list) =>
      list.map((m) => (m.id === messageId && m.role === "assistant" ? { ...m, retry: undefined } : m))
    )
    ask(text, history, targetId)
  }

  async function confirm(messageId: number, index: number) {
    const msg = messages.find((m) => m.id === messageId)
    if (!msg || msg.role !== "assistant" || !msg.slots || !msg.title || msg.chosen !== undefined) return

    const slot = msg.slots[index]
    const body = {
      title: msg.title,
      start: toLocalString(parseISO(slot.start)),
      end: toLocalString(parseISO(slot.end)),
    }
    const setChosen = (chosen: number | undefined) =>
      setMessages((list) =>
        list.map((m) => (m.id === messageId && m.role === "assistant" ? { ...m, chosen } : m))
      )

    setChosen(index) // mark first, so a second click cannot repeat the action
    try {
      if (msg.eventId !== undefined) {
        await updateEvent(msg.eventId, body) // move the existing event
        if (target?.id === msg.eventId) onClearTarget()
      } else {
        await createEvent(body)
      }
      onScheduled(parseISO(slot.start))
    } catch (err) {
      setChosen(undefined)
      fail(err)
    }
  }

  return (
    <aside className="flex max-h-[40vh] shrink-0 flex-col border-t md:max-h-none md:w-96 md:border-l md:border-t-0">
      <div className="hidden border-b px-4 py-3 text-sm font-medium md:block">Assistant</div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="max-w-[92%] space-y-2">
              <div className={`w-fit rounded-lg bg-muted px-3 py-2 text-sm ${m.error ? "text-red-600" : ""}`}>
                {m.text}
              </div>

              {m.retry && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => retry(m.id)}
                >
                  <RotateCw /> Try again
                </Button>
              )}

              {m.slots?.map((slot, i) => {
                const start = parseISO(slot.start)
                const end = parseISO(slot.end)
                return (
                  <Button
                    key={slot.start}
                    variant="outline"
                    disabled={m.chosen !== undefined}
                    onClick={() => confirm(m.id, i)}
                    className="h-auto w-full justify-between py-2 text-left disabled:opacity-60"
                  >
                    <span>
                      <span className="block text-sm">{format(start, "EEE d MMM")}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {format(start, "HH:mm")} - {format(end, "HH:mm")}
                        {!slot.matchesPreferences && " (outside your preferences)"}
                      </span>
                    </span>
                    {m.chosen === i && <Check className="size-4" />}
                  </Button>
                )
              })}

              {m.chosen !== undefined && (
                <p className="text-xs text-muted-foreground">
                  {m.eventId !== undefined ? "Event moved." : "Added to your calendar."}
                </p>
              )}
            </div>
          )
        )}

        {busy && <div className="w-fit rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      {target && (
        <div className="flex items-center gap-2 border-t bg-muted/40 px-3 py-2 text-xs">
          <span className="min-w-0 flex-1 truncate">
            Rescheduling: <span className="font-medium">{target.title}</span>,{" "}
            {format(parseISO(target.start), "EEE d MMM HH:mm")}
          </span>
          <Button variant="ghost" size="icon" className="size-6" onClick={onClearTarget} aria-label="Cancel rescheduling">
            <X className="size-3" />
          </Button>
        </div>
      )}

      <form onSubmit={send} className="flex items-center gap-2 border-t p-3">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={target ? "When should it move? e.g. Thursday evening" : "What do you need to do?"}
          maxLength={500}
          disabled={busy}
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
          <SendHorizontal />
        </Button>
      </form>
    </aside>
  )
}