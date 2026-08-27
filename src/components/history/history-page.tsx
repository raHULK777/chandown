import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { open } from "@tauri-apps/plugin-shell"
import { useTauriCommand } from "@/hooks/use-tauri-command"
import type { DownloadItem } from "@/types"
import { formatBytes } from "@/utils"
import { ExternalLink, FolderOpen, Clock, Music, Video, Trash2 } from "lucide-react"

function formatLabel(item: DownloadItem): string {
  if (item.audio_only) {
    const af = (item.audio_format ?? "mp3").toUpperCase()
    const aq = item.audio_quality ?? ""
    return aq ? `${af} ${aq}kbps` : af
  }
  const fmt = item.format_id ?? ""
  const vf = item.video_format ?? ""
  const res = fmt.replace(/p$/, "")
  return vf ? `${res}p ${vf.toUpperCase()}` : `${res}p`
}

function HistoryPage() {
  const { invoke } = useTauriCommand()
  const [items, setItems] = useState<DownloadItem[]>([])

  const fetchHistory = useCallback(async () => {
    try {
      const history = await invoke<DownloadItem[]>("get_history")
      setItems(history)
    } catch { /* ignore */ }
  }, [invoke])

  useEffect(() => {
    fetchHistory()
    const interval = setInterval(fetchHistory, 3000)
    return () => clearInterval(interval)
  }, [fetchHistory])

  const handleClear = async () => {
    try {
      await invoke("clear_history")
      setItems([])
    } catch { /* ignore */ }
  }

  const completedItems = items

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
        {completedItems.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Clear History
          </Button>
        )}
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
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
                      {item.audio_only ? <Music className="inline h-3 w-3 mr-0.5" /> : <Video className="inline h-3 w-3 mr-0.5" />}
                      {formatLabel(item)}
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

export { HistoryPage }
