import { useEffect, useState, useCallback } from "react"
import { useDownloadStore } from "@/stores/download-store"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { open } from "@tauri-apps/plugin-shell"
import { useTauriCommand } from "@/hooks/use-tauri-command"
import { useTauriEvent } from "@/hooks/use-tauri-event"
import type { QueueState, DownloadItem } from "@/types"
import { formatBytes } from "@/utils"
import { Pause, Play, X, Trash2, FolderOpen, ExternalLink, Film, Music, Video, RefreshCw, AlertTriangle } from "lucide-react"

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

function QueuePage() {
  const store = useDownloadStore()
  const { invoke } = useTauriCommand()
  const [updateInfo, setUpdateInfo] = useState<{ available: boolean; message: string } | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updatingYtdlp, setUpdatingYtdlp] = useState(false)

  const checkForUpdate = useCallback(async () => {
    try {
      setCheckingUpdate(true)
      const result = await invoke<{ update_available: boolean; message: string }>("check_for_ytdlp_update")
      setUpdateInfo({ available: result.update_available, message: result.message })
    } catch {
      setUpdateInfo(null)
    } finally {
      setCheckingUpdate(false)
    }
  }, [invoke])

  const handleUpdateYtdlp = async () => {
    try {
      setUpdatingYtdlp(true)
      await invoke("update_ytdlp")
      setUpdateInfo(null)
    } catch {
      setUpdateInfo(null)
    } finally {
      setUpdatingYtdlp(false)
    }
  }

  const fetchQueue = async () => {
    try {
      const state = await invoke<QueueState>("get_queue")
      store.setQueue(state)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchQueue()
    const interval = setInterval(fetchQueue, 2000)
    return () => clearInterval(interval)
  }, [])

  useTauriEvent("download-progress", (payload: unknown) => {
    const data = payload as { id: string; progress: number; speed: string | null; eta: string | null }
    store.updateItem(data.id, {
      progress: data.progress,
      speed: data.speed,
      eta: data.eta,
    })
  })

  useTauriEvent("download-status", (payload: unknown) => {
    const data = payload as { id: string; status: DownloadItem["status"]; error?: string }
    store.updateItem(data.id, { status: data.status, error: data.error ?? null })
    if (data.status === "Failed") {
      checkForUpdate()
    }
  })

  const handleCancel = (id: string) => invoke("cancel_download", { id }).catch(() => {})
  const handlePause = (id: string) => invoke("pause_download", { id }).catch(() => {})
  const handleResume = (id: string) => invoke("resume_download", { id }).catch(() => {})
  const handleClear = () => { invoke("clear_queue").catch(() => {}); store.clearCompleted() }

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

  const activeItems = store.queue.filter(
    (i) => i.status === "Downloading" || i.status === "Queued" || i.status === "Paused"
  )
  const completedItems = store.queue.filter(
    (i) => i.status === "Completed" || i.status === "Failed" || i.status === "Cancelled"
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Download Queue</h1>
        <Button variant="outline" size="sm" onClick={handleClear}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Clear Completed
        </Button>
      </div>

      {updateInfo?.available && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-600">yt-dlp update available</p>
                <p className="text-xs text-muted-foreground mt-1">{updateInfo.message}</p>
                <p className="text-xs text-muted-foreground mt-1">Updating may fix download failures.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleUpdateYtdlp}
                disabled={updatingYtdlp}
                className="shrink-0"
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${updatingYtdlp ? "animate-spin" : ""}`} />
                {updatingYtdlp ? "Updating..." : "Update yt-dlp"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!updateInfo && checkingUpdate && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Checking for yt-dlp updates...
        </div>
      )}

      {activeItems.length === 0 && completedItems.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Film className="mb-4 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-medium">Queue is empty</h3>
            <p className="text-sm text-muted-foreground mt-1">Downloads will appear here</p>
          </CardContent>
        </Card>
      )}

      {activeItems.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Active ({activeItems.length})</h2>
          {activeItems.map((item) => (
            <DownloadRow
              key={item.id}
              item={item}
              onCancel={handleCancel}
              onPause={handlePause}
              onResume={handleResume}
              onPlay={openFile}
              onOpenFolder={showInFolder}
            />
          ))}
        </div>
      )}

      {completedItems.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Completed ({completedItems.length})</h2>
          {completedItems.map((item) => (
            <DownloadRow
              key={item.id}
              item={item}
              onCancel={handleCancel}
              onPause={handlePause}
              onResume={handleResume}
              onPlay={openFile}
              onOpenFolder={showInFolder}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface DownloadRowProps {
  item: DownloadItem
  onCancel: (id: string) => void
  onPause: (id: string) => void
  onResume: (id: string) => void
  onPlay: (path: string | null) => void
  onOpenFolder: (path: string | null) => void
}

const statusColor: Record<string, string> = {
  Queued: "bg-muted text-muted-foreground",
  Downloading: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Paused: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  Completed: "bg-green-500/10 text-green-500 border-green-500/20",
  Failed: "bg-destructive/10 text-destructive",
  Cancelled: "bg-muted text-muted-foreground",
}

function DownloadRow({ item, onCancel, onPause, onResume, onPlay, onOpenFolder }: DownloadRowProps) {
  const isCompleted = item.status === "Completed"

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h4 className="truncate text-sm font-medium">{item.title}</h4>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={statusColor[item.status]}>
                {item.status}
              </Badge>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
                {item.audio_only ? <Music className="inline h-3 w-3 mr-0.5" /> : <Video className="inline h-3 w-3 mr-0.5" />}
                {formatLabel(item)}
              </Badge>
              {item.speed && <span className="text-xs text-muted-foreground tabular-nums">{item.speed}</span>}
              {item.eta && <span className="text-xs text-muted-foreground tabular-nums">ETA: {item.eta}</span>}
              {item.filesize && <span className="text-xs text-muted-foreground tabular-nums">{formatBytes(item.filesize)}</span>}
              {item.error && <span className="text-xs text-destructive truncate max-w-[300px]">{item.error}</span>}
            </div>
            {item.status === "Downloading" && (
              <div className="mt-2 flex items-center gap-3">
                <Progress value={item.progress} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                  {item.progress.toFixed(0)}%
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {item.status === "Downloading" && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onPause(item.id)} title="Pause">
                <Pause className="h-3.5 w-3.5" />
              </Button>
            )}
            {item.status === "Paused" && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onResume(item.id)} title="Resume">
                <Play className="h-3.5 w-3.5" />
              </Button>
            )}
            {item.status === "Queued" && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCancel(item.id)} title="Cancel">
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            {isCompleted && item.file_path && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onPlay(item.file_path)} title="Play">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenFolder(item.file_path)} title="Open folder">
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { QueuePage }
