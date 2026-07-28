import { useState, useEffect, useMemo } from "react"
import { useChannelStore } from "@/stores/channel-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useTauriCommand } from "@/hooks/use-tauri-command"
import { FolderOpen, Loader2 } from "lucide-react"

interface DownloadDialogProps {
  onClose: () => void
}

interface ResolvedItem {
  id: string
  url: string
  title: string
  subfolder: string | null
}

function DownloadDialog({ onClose }: DownloadDialogProps) {
  const store = useChannelStore()
  const { invoke } = useTauriCommand()
  const [format, setFormat] = useState<"video" | "audio">("video")
  const [quality, setQuality] = useState("1080p")
  const [videoContainer, setVideoContainer] = useState("mp4")
  const [audioFormat, setAudioFormat] = useState("mp3")
  const [audioQuality, setAudioQuality] = useState("192")
  const [outputPath, setOutputPath] = useState("")
  const [downloading, setDownloading] = useState(false)
  const [resolving, setResolving] = useState(true)
  const [resolvedItems, setResolvedItems] = useState<ResolvedItem[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const { downloadDir } = await import("@tauri-apps/api/path")
        const dir = await downloadDir()
        setOutputPath(dir)
      } catch {
        setOutputPath("Downloads")
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      setResolving(true)
      const items: ResolvedItem[] = []

      const videoIds = new Set(store.selectedIds)
      const playlistMap = new Map(store.playlists.filter(p => videoIds.has(p.id)).map(p => [p.id, p]))

      for (const pl of playlistMap.values()) {
        videoIds.delete(pl.id)
        try {
          const videos = await invoke<{ id: string; url: string; title: string }[]>("fetch_playlist_videos", { playlistUrl: pl.url })
          for (const v of videos) {
            items.push({ id: v.id, url: v.url, title: v.title, subfolder: pl.title })
          }
        } catch { /* skip if fetch fails */ }
      }

      for (const v of store.videos) {
        if (videoIds.has(v.id)) {
          items.push({ id: v.id, url: v.url, title: v.title, subfolder: null })
        }
      }
      for (const v of store.shorts) {
        if (videoIds.has(v.id)) {
          items.push({ id: v.id, url: v.url, title: v.title, subfolder: null })
        }
      }
      for (const v of store.streams) {
        if (videoIds.has(v.id)) {
          items.push({ id: v.id, url: v.url, title: v.title, subfolder: null })
        }
      }

      setResolvedItems(items)
      setResolving(false)
    })()
  }, [store.selectedIds, store.playlists, store.videos, store.shorts, store.streams])

  const handleBrowse = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog")
      const selected = await open({ directory: true, multiple: false, title: "Select download folder" })
      if (selected) setOutputPath(selected as string)
    } catch { /* ignore */ }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      for (const item of resolvedItems) {
        const path = item.subfolder ? `${outputPath}\\${sanitize(item.subfolder)}` : outputPath
        await invoke("start_download", {
          request: {
            url: item.url,
            title: item.title,
            format_id: quality,
            output_path: path,
            quality,
            audio_only: format === "audio",
            audio_format: format === "audio" ? audioFormat : null,
            audio_quality: format === "audio" ? audioQuality : null,
            video_format: format === "video" ? videoContainer : null,
          },
        })
      }
      store.clearSelection()
      onClose()
    } catch (err) {
      console.error("Download failed:", err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        <CardContent className="pt-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold">
              {resolving ? "Preparing..." : `Download ${resolvedItems.length} items`}
            </h2>
            <p className="text-sm text-muted-foreground">Select format and output options</p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Format</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormat("video")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                  format === "video" ? "border-primary bg-primary/5 text-primary" : "border-input hover:bg-accent"
                }`}
              >
                Video + Audio
              </button>
              <button
                onClick={() => setFormat("audio")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                  format === "audio" ? "border-primary bg-primary/5 text-primary" : "border-input hover:bg-accent"
                }`}
              >
                Audio Only
              </button>
            </div>

            {format === "video" ? (
              <>
                <div>
                  <label className="text-sm font-medium">Resolution</label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="2160p">4K (2160p)</option>
                    <option value="1440p">2K (1440p)</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                    <option value="360p">360p</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Container</label>
                  <select
                    value={videoContainer}
                    onChange={(e) => setVideoContainer(e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="mp4">MP4</option>
                    <option value="mkv">MKV</option>
                    <option value="webm">WebM</option>
                    <option value="avi">AVI</option>
                  </select>
                </div>
              </>
            ) : (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm font-medium">Format</label>
                  <select
                    value={audioFormat}
                    onChange={(e) => setAudioFormat(e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="mp3">MP3</option>
                    <option value="m4a">M4A</option>
                    <option value="flac">FLAC</option>
                    <option value="opus">Opus</option>
                    <option value="wav">WAV</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium">Quality</label>
                  <select
                    value={audioQuality}
                    onChange={(e) => setAudioQuality(e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="320">320 kbps</option>
                    <option value="256">256 kbps</option>
                    <option value="192">192 kbps</option>
                    <option value="128">128 kbps</option>
                    <option value="96">96 kbps</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Output location</label>
            <div className="mt-1 flex gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  value={outputPath}
                  onChange={(e) => setOutputPath(e.target.value)}
                  placeholder="Select download folder"
                  className="w-full"
                />
              </div>
              <Button variant="outline" size="icon" onClick={handleBrowse} title="Browse...">
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            {resolving ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Resolving playlist contents...
              </div>
            ) : (
              <span>{resolvedItems.length} item{resolvedItems.length !== 1 ? "s" : ""} will be downloaded</span>
            )}
            {!resolving && resolvedItems.some(i => i.subfolder) && (
              <p className="text-xs mt-1 text-muted-foreground">
                Playlist items will be saved in subfolders
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={downloading}>
              Cancel
            </Button>
            <Button onClick={handleDownload} disabled={downloading || resolving || resolvedItems.length === 0}>
              {downloading ? "Starting..." : "Download Now"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim()
}

export { DownloadDialog }
