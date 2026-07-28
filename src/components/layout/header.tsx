import { useEffect, useState, useRef } from "react"
import { useSettingsStore } from "@/stores/settings-store"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Minus, Square, X, Sun, Moon, Monitor } from "lucide-react"

function Header() {
  const { theme, setTheme } = useSettingsStore()
  const [mounted, setMounted] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const dragRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const win = getCurrentWindow()
    win.isMaximized().then(setIsMaximized)
    const unlisten = win.onResized(() => {
      win.isMaximized().then(setIsMaximized)
    })
    return () => { unlisten.then((fn) => fn()) }
  }, [])

  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    getCurrentWindow().startDragging()
  }

  const handleMinimize = () => getCurrentWindow().minimize()
  const handleMaximize = () => getCurrentWindow().toggleMaximize()
  const handleClose = () => getCurrentWindow().close()

  const cycleTheme = () => {
    const themes: ("light" | "dark" | "system")[] = ["light", "dark", "system"]
    const currentIndex = themes.indexOf(theme)
    setTheme(themes[(currentIndex + 1) % themes.length])
  }

  const themeIcon = { light: Sun, dark: Moon, system: Monitor }
  const ThemeIcon = themeIcon[theme]

  return (
    <header className="flex h-10 items-center border-b bg-background select-none">
      <div
        ref={dragRef}
        onMouseDown={startDrag}
        className="flex flex-1 items-center gap-2 px-4 h-full cursor-default"
      >
        <img src="/ClipDownLogo.png" alt="ClipDown" className="h-5 w-5" />
        <span className="text-xs font-semibold text-muted-foreground">ClipDown</span>
      </div>

      <div className="flex items-center h-full">
        {mounted && (
          <button
            onClick={cycleTheme}
            className="flex items-center justify-center h-full w-10 hover:bg-accent transition-colors"
            title={`Theme: ${theme}`}
          >
            <ThemeIcon className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          onClick={handleMinimize}
          className="flex items-center justify-center h-full w-11 hover:bg-accent transition-colors"
          title="Minimize"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={handleMaximize}
          className="flex items-center justify-center h-full w-11 hover:bg-accent transition-colors"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          <Square className="h-3 w-3" />
        </button>

        <button
          onClick={handleClose}
          className="flex items-center justify-center h-full w-11 hover:bg-destructive hover:text-destructive-foreground transition-colors"
          title="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  )
}

export { Header }
