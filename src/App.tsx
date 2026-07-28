import React, { useEffect, useState } from "react"
import { useSettingsStore } from "@/stores/settings-store"
import { Sidebar, type Page } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { HomePage } from "@/components/layout/home-page"
import { QueuePage } from "@/components/queue/queue-page"
import { HistoryPage } from "@/components/history/history-page"
import { SettingsPage } from "@/components/settings/settings-page"

type PageComponent = () => React.ReactElement

const pages: Record<Page, PageComponent> = {
  home: HomePage,
  queue: QueuePage,
  history: HistoryPage,
  settings: SettingsPage,
}

function App() {
  const theme = useSettingsStore((s) => s.theme)
  const [mounted, setMounted] = useState(false)
  const [activePage, setActivePage] = useState<Page>("home")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const handler = (e: Event) => {
      const page = (e as CustomEvent).detail as Page
      setActivePage(page)
    }
    window.addEventListener("navigate", handler)
    return () => window.removeEventListener("navigate", handler)
  }, [mounted])

  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      root.classList.toggle("dark", prefersDark)
    } else {
      root.classList.toggle("dark", theme === "dark")
    }
  }, [theme, mounted])

  if (!mounted) return null

  const PageComponent = pages[activePage]

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <PageComponent />
        </main>
      </div>
    </div>
  )
}

export { App }
