import { useEffect, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { Check, RotateCw, SendHorizontal, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createEvent, sendChat, toLocalString, updateEvent } from "@/lib/api"
import { COLORS, colorForTitle, resolveColor, type EventColor } from "@/lib/colors"
import { cn } from "@/lib/utils"
import type { CalendarEvent, Slot } from "@/types"

type Message =
  | { id: number; role: "user"; text: string }
  | {
      id: number
      role: "assistant"
      text: string
      error?: boolean
      title?: string
      color?: EventColor
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
  open: boolean
  onOpenChange: (open: boolean) => void
  target: CalendarEvent | null // event selected for rescheduling
  onClearTarget: () => void
  onScheduled: (start: Date) => void
}

export function ChatPanel({ open, onOpenChange, target, onClearTarget, onScheduled }: Props) {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const nextId = useRef(1)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, busy, open])

  // When an event is selected for rescheduling, jump straight to typing
  useEffect(() => {
    if (target && open) inputRef.current?.focus()
  }, [target, open])

  const add = (m: DistributiveOmit<Message, "id">) =>
    setMessages((list) => [...list, { ...m, id: nextId.current++ } as Message])

  const fail = (e: unknown) =>
    add({ role: "assistant", text: e instanceof Error ? e.message : String(e), error: true })

  async function ask(text: string, history: string[], targetId?: number) {
    // A moved event keeps its own color, a new one gets the color for its title
    const targetColor = target && target.id === targetId ? resolveColor(target) : undefined

    setBusy(true)
    try {
      const r = await sendChat(text, targetId, history)
      add({
        role: "assistant",
        text: r.reply,
        title: r.title ?? undefined,
        color: targetColor ?? (r.title ? colorForTitle(r.title) : undefined),
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
        await updateEvent(msg.eventId, body) // move the existing event, its color is kept
        if (target?.id === msg.eventId) onClearTarget()
      } else {
        await createEvent({ ...body, color: msg.color ?? colorForTitle(msg.title) })
      }
      onScheduled(parseISO(slot.start))
    } catch (err) {
      setChosen(undefined)
      fail(err)
    }
  }

  return (
    <>
      {/* Closed: a tab on the right edge (desktop) or a round button (phone) */}
      {!open && (
        <>
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            aria-label="Open assistant"
            className="fixed right-0 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-3 rounded-l-2xl bg-primary px-2.5 py-4 text-primary-foreground shadow-lg transition-transform hover:-translate-x-0.5 md:flex"
          >
            <Sparkles className="size-4" />
            <span className="text-xs [writing-mode:vertical-rl]">Ask AI</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            aria-label="Open assistant"
            className="fixed bottom-5 right-5 z-30 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
          >
            <Sparkles className="size-5" />
          </button>
        </>
      )}

      {/* The panel stays mounted when closed, so the conversation is kept */}
      <aside
        inert={!open}
        aria-hidden={!open}
        className={cn(
          "shrink-0 overflow-hidden rounded-2xl bg-card shadow-sm transition-all duration-300 ease-out",
          open
            ? "mx-3 mb-3 max-h-[50dvh] md:mx-0 md:my-3 md:mr-3 md:max-h-none md:w-96"
            : "mx-3 max-h-0 md:mx-0 md:my-3 md:max-h-none md:w-0"
        )}
      >
         <div className="flex max-h-[50dvh] min-h-0 flex-col md:h-full md:max-h-none md:w-96">
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <div>
              <div className="text-base font-semibold tracking-tight">Assistant</div>
              <div className="text-xs text-muted-foreground">Describe what you need to do</div>
            </div>
            <Button variant="outline" size="icon" onClick={() => onOpenChange(false)} aria-label="Close assistant">
              <X />
            </Button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-2">
            {messages.map((m) =>
              m.role === "user" ? (
                <div
                  key={m.id}
                  className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                >
                  {m.text}
                </div>
              ) : (
                <div key={m.id} className="max-w-[92%] space-y-2">
                  <div
                    className={`w-fit rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm ${
                      m.error ? "text-destructive" : ""
                    }`}
                  >
                    {m.text}
                  </div>

                  {m.retry && (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => retry(m.id)}>
                      <RotateCw /> Try again
                    </Button>
                  )}

                  {m.slots?.map((slot, i) => {
                    const start = parseISO(slot.start)
                    const end = parseISO(slot.end)
                    return (
                      <button
                        key={slot.start}
                        type="button"
                        disabled={m.chosen !== undefined}
                        onClick={() => confirm(m.id, i)}
                        className={`flex w-full items-center justify-between rounded-card px-4 py-3 text-left transition-colors disabled:cursor-default disabled:opacity-60 ${
                          COLORS[m.color ?? colorForTitle(m.title ?? "")].card
                        }`}
                      >
                        <span>
                          <span className="block text-sm">{format(start, "EEE d MMM")}</span>
                          <span className="block text-xs opacity-70">
                            {format(start, "HH:mm")} - {format(end, "HH:mm")}
                            {!slot.matchesPreferences && " (outside your preferences)"}
                          </span>
                        </span>
                        {m.chosen === i && <Check className="size-4" />}
                      </button>
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

            {busy && (
              <div className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm">
                <span className="shimmer">Thinking...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {target && (
            <div className="mx-4 mb-2 flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-xs">
              <span className="min-w-0 flex-1 truncate">
                Rescheduling: <span className="font-semibold">{target.title}</span>,{" "}
                {format(parseISO(target.start), "EEE d MMM HH:mm")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={onClearTarget}
                aria-label="Cancel rescheduling"
              >
                <X className="size-3" />
              </Button>
            </div>
          )}

          <form onSubmit={send} className="flex items-center gap-2 p-4">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={target ? "When should it move? e.g. Thursday evening" : "What do you need to do?"}
              maxLength={500}
              disabled={busy}
              className="h-10 rounded-full px-4"
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
              <SendHorizontal />
            </Button>
          </form>
        </div>
      </aside>
    </>
  )
}