import { useState } from "react"
import { cn } from "@/lib/utils"
import { useSettingsStore } from "@/stores/settings-store"

type Page = "home" | "queue" | "history" | "settings"

interface NavItem {
  id: Page
  label: string
  icon: string
}

const navItems: NavItem[] = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "queue", label: "Queue", icon: "📋" },
  { id: "history", label: "History", icon: "🕐" },
  { id: "settings", label: "Settings", icon: "⚙️" },
]

interface SidebarProps {
  className?: string
}

function Sidebar({ className }: SidebarProps) {
  const [activePage, setActivePage] = useState<Page>("home")
  const theme = useSettingsStore((s) => s.theme)

  const handleNav = (page: Page) => {
    setActivePage(page)
    window.dispatchEvent(new CustomEvent("navigate", { detail: page }))
  }

  return (
    <aside
      className={cn(
        "flex w-56 flex-col border-r bg-sidebar text-sidebar-foreground",
        className
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <img src="/ChanDownLogo.png" alt="ChanDown" className="h-6 w-6" />
        <span className="text-sm font-semibold">ChanDown</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNav(item.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              activePage === item.id
                ? "bg-sidebar-active text-foreground font-medium"
                : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
          <span>v0.1.0</span>
        </div>
      </div>
    </aside>
  )
}

export { Sidebar }
export type { Page }
