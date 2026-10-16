import { useEffect, useState } from "react"

// The current time, refreshed every minute, so the "now" line moves by itself
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}