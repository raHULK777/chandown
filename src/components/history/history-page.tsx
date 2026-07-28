import { useEffect } from "react"
import { useDownloadStore } from "@/stores/download-store"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { open } from "@tauri-apps/plugin-shell"
import { useTauriCommand } from "@/hooks/use-tauri-command"
import type { QueueState, DownloadItem } from "@/types"
import { ExternalLink, FolderOpen, Clock } from "lucide-react"

function HistoryPage() {
  const store = useDownloadStore()
  const { invoke } = useTauriCommand()

  useEffect(() => {
    const fetchCompleted = async () => {
      try {
        const state = await invoke<QueueState>("get_queue")
        store.setQueue(state)
      } catch { /* ignore */ }
    }
    fetchCompleted()
    const interval = setInterval(fetchCompleted, 3000)
    return () => clearInterval(interval)
  }, [])

  const completedItems = store.queue.filter(
    (i) => i.status === "Completed" || i.status === "Failed" || i.status === "Cancelled"
  )

  const openFile = (filePath: string | null) => {
    if (!filePath) return
    open(filePath).catch(() => {})
  }

  const showInFolder = (filePath: string | null) => {
    if (!filePath) return
    let parent = filePath.replace(/\\[^\\]+$/, "")
    if (parent === filePath) parent = filePath.replace(/\/[^/]+$/, "")
    if (parent === filePath) return
    open(parent).catch(() => {})
  }

  const statusColor: Record<string, string> = {
    Completed: "border-green-500/20 text-green-500",
    Failed: "border-destructive/20 text-destructive",
    Cancelled: "border-muted text-muted-foreground",
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Download History</h1>
      </div>

      {completedItems.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Clock className="mb-4 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-medium">No download history</h3>
            <p className="text-sm text-muted-foreground mt-1">Completed downloads will appear here</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-1">
        {completedItems.map((item) => (
          <Card key={item.id}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="truncate text-sm font-medium">{item.title}</h4>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <Badge variant="outline" className={statusColor[item.status]}>
                      {item.status}
                    </Badge>
                    <span>{new Date(item.queued_at).toLocaleString()}</span>
                    {item.filesize && <span>{formatBytes(item.filesize)}</span>}
                  </div>
                  {item.error && <p className="mt-0.5 text-xs text-destructive">{item.error}</p>}
                </div>
                {item.status === "Completed" && item.file_path && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openFile(item.file_path)} title="Play">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => showInFolder(item.file_path)} title="Open folder">
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

export { HistoryPage }
