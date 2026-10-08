import { useEffect, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { Check, SendHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createEvent, sendChat, toLocalString } from "@/lib/api"
import type { Slot } from "@/types"

type Message =
  | { id: number; role: "user"; text: string }
  | {
      id: number
      role: "assistant"
      text: string
      error?: boolean
      title?: string
      slots?: Slot[]
      chosen?: number // index of the slot the user confirmed
    }

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

const WELCOME: Message = {
  id: 0,
  role: "assistant",
  text: 'Tell me what you need to do and I will find time for it. For example: "Find me two hours to study Java this week, preferably in the evening."',
}

type Props = {
  onScheduled: (start: Date) => void
}

export function ChatPanel({ onScheduled }: Props) {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const nextId = useRef(1)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Keep the newest message in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, busy])

  const add = (m: DistributiveOmit<Message, "id">) =>
    setMessages((list) => [...list, { ...m, id: nextId.current++ } as Message])

  const fail = (e: unknown) =>
    add({ role: "assistant", text: e instanceof Error ? e.message : String(e), error: true })

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return

    setInput("")
    add({ role: "user", text })
    setBusy(true)
    try {
      const r = await sendChat(text)
      add({ role: "assistant", text: r.reply, title: r.title ?? undefined, slots: r.suggestions })
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  async function confirm(messageId: number, index: number) {
    const msg = messages.find((m) => m.id === messageId)
    if (!msg || msg.role !== "assistant" || !msg.slots || !msg.title || msg.chosen !== undefined) return

    const slot = msg.slots[index]
    const setChosen = (chosen: number | undefined) =>
      setMessages((list) =>
        list.map((m) => (m.id === messageId && m.role === "assistant" ? { ...m, chosen } : m))
      )

    setChosen(index) // mark first, so a second click cannot create a duplicate
    try {
      await createEvent({
        title: msg.title,
        start: toLocalString(parseISO(slot.start)),
        end: toLocalString(parseISO(slot.end)),
      })
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
              <div
                className={`w-fit rounded-lg bg-muted px-3 py-2 text-sm ${m.error ? "text-red-600" : ""}`}
              >
                {m.text}
              </div>

              {m.slots?.map((slot, i) => {
                const start = parseISO(slot.start)
                const end = parseISO(slot.end)
                const isChosen = m.chosen === i
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
                    {isChosen && <Check className="size-4" />}
                  </Button>
                )
              })}

              {m.chosen !== undefined && (
                <p className="text-xs text-muted-foreground">Added to your calendar.</p>
              )}
            </div>
          )
        )}

        {busy && <div className="w-fit rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Thinking...</div>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What do you need to do?"
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