import { useEffect, useState } from "react"

export type Theme = "light" | "dark"

function initialTheme(): Theme {
  const stored = localStorage.getItem("theme")
  if (stored === "light" || stored === "dark") return stored
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  // Tailwind's dark styles apply when <html> has the "dark" class
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark"
    localStorage.setItem("theme", next) // only saved once the user chooses
    setTheme(next)
  }

  return { theme, toggle }
}