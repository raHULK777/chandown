import { useState, useEffect, useRef } from "react"
import { useChannelStore } from "@/stores/channel-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useTauriCommand } from "@/hooks/use-tauri-command"
import { formatBytes } from "@/utils"
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
  const [selectedResolvedIds, setSelectedResolvedIds] = useState<Set<string>>(new Set())
  const [playlistItems, setPlaylistItems] = useState<ResolvedItem[]>([])
  const [directItems, setDirectItems] = useState<ResolvedItem[]>([])
  const [estimatedSizes, setEstimatedSizes] = useState<Map<string, number | null>>(new Map())
  const [estimating, setEstimating] = useState(false)
  const estimationGen = useRef(0)

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
      const plItems: ResolvedItem[] = []
      const dirItems: ResolvedItem[] = []

      const videoIds = new Set(store.selectedIds)
      const playlistMap = new Map(store.playlists.filter(p => videoIds.has(p.id)).map(p => [p.id, p]))

      for (const pl of playlistMap.values()) {
        videoIds.delete(pl.id)
        try {
          const videos = await invoke<{ id: string; url: string; title: string }[]>("fetch_playlist_videos", { playlistUrl: pl.url })
          for (const v of videos) {
            plItems.push({ id: v.id, url: v.url, title: v.title, subfolder: pl.title })
          }
        } catch { /* skip if fetch fails */ }
      }

      for (const v of store.videos) {
        if (videoIds.has(v.id)) {
          dirItems.push({ id: v.id, url: v.url, title: v.title, subfolder: null })
        }
      }
      for (const v of store.shorts) {
        if (videoIds.has(v.id)) {
          dirItems.push({ id: v.id, url: v.url, title: v.title, subfolder: null })
        }
      }
      for (const v of store.streams) {
        if (videoIds.has(v.id)) {
          dirItems.push({ id: v.id, url: v.url, title: v.title, subfolder: null })
        }
      }

      const allItems = [...dirItems, ...plItems]
      setPlaylistItems(plItems)
      setDirectItems(dirItems)
      setResolvedItems(allItems)
      setSelectedResolvedIds(new Set(allItems.map(i => i.id)))
      setResolving(false)
    })()
  }, [store.selectedIds, store.playlists, store.videos, store.shorts, store.streams])

  useEffect(() => {
    if (resolving || resolvedItems.length === 0) return

    const gen = ++estimationGen.current
    setEstimating(true)
    setEstimatedSizes(new Map())

    const selectedItems = resolvedItems.filter(i => selectedResolvedIds.has(i.id))
    if (selectedItems.length === 0) {
      setEstimating(false)
      return
    }

    const CONCURRENT = 3
    let active = 0
    let idx = 0
    let done = false

    const fetchNext = async () => {
      while (idx < selectedItems.length && !done) {
        if (active >= CONCURRENT) return
        const item = selectedItems[idx++]
        active++
        try {
          const res = await invoke<number | null>("estimate_video_size", {
            videoUrl: item.url,
            resolution: parseInt(quality),
          })
          if (done) return
          setEstimatedSizes(prev => {
            const next = new Map(prev)
            next.set(item.id, res)
            return next
          })
        } catch {
          if (!done) {
            setEstimatedSizes(prev => {
              const next = new Map(prev)
              next.set(item.id, null)
              return next
            })
          }
        } finally {
          active--
          if (!done) fetchNext()
          else if (active === 0) setEstimating(false)
        }
      }
      if (active === 0 && !done) setEstimating(false)
    }

    for (let i = 0; i < Math.min(CONCURRENT, selectedItems.length); i++) {
      fetchNext()
    }

    return () => {
      done = true
    }
  }, [resolving, resolvedItems, selectedResolvedIds, quality, format])

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
      const toDownload = resolvedItems.filter(i => selectedResolvedIds.has(i.id))
      for (const item of toDownload) {
        const path = item.subfolder ? `${outputPath}\\${sanitize(item.subfolder)}` : outputPath
        await invoke("start_download", {
          request: {
            url: item.url,
            title: item.title,
            format_id: format === "audio" ? "bestaudio" : quality,
            output_path: path,
            quality: format === "audio" ? audioQuality : quality,
            audio_only: format === "audio",
            audio_format: format === "audio" ? audioFormat : null,
            audio_quality: format === "audio" ? audioQuality : null,
            video_format: format === "video" ? videoContainer : null,
            filesize: estimatedSizes.get(item.id) ?? null,
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
              {resolving ? "Preparing..." : `Download ${selectedResolvedIds.size} of ${resolvedItems.length} items`}
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

          {!resolving && playlistItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Playlist Videos</label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    const allIds = new Set(playlistItems.map(i => i.id))
                    if (playlistItems.every(i => selectedResolvedIds.has(i.id))) {
                      setSelectedResolvedIds(prev => {
                        const next = new Set(prev)
                        for (const id of allIds) next.delete(id)
                        return next
                      })
                    } else {
                      setSelectedResolvedIds(prev => new Set([...prev, ...allIds]))
                    }
                  }}
                >
                  {playlistItems.every(i => selectedResolvedIds.has(i.id)) ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                {playlistItems.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary shrink-0"
                      checked={selectedResolvedIds.has(item.id)}
                      onChange={() => {
                        setSelectedResolvedIds(prev => {
                          const next = new Set(prev)
                          if (next.has(item.id)) next.delete(item.id)
                          else next.add(item.id)
                          return next
                        })
                      }}
                    />
                    <span className="truncate min-w-0 flex-1">{item.title}</span>
                    {selectedResolvedIds.has(item.id) && (
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        {estimatedSizes.has(item.id) ? (
                          estimatedSizes.get(item.id) != null ? (
                            formatBytes(estimatedSizes.get(item.id)!)
                          ) : (
                            <span className="text-destructive">N/A</span>
                          )
                        ) : estimating ? (
                          <Loader2 className="h-3 w-3 animate-spin inline" />
                        ) : null}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            {resolving ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Resolving playlist contents...
              </div>
            ) : (
              <div className="space-y-1">
                <span>
                  {selectedResolvedIds.size} of {resolvedItems.length} item{resolvedItems.length !== 1 ? "s" : ""} selected for download
                </span>
                {!estimating && estimatedSizes.size > 0 && (() => {
                  let total = 0
                  let counted = 0
                  for (const [id, size] of estimatedSizes) {
                    if (selectedResolvedIds.has(id) && size != null) {
                      total += size
                      counted++
                    }
                  }
                  if (counted > 0) {
                    return (
                      <span className="block text-xs">
                        Estimated total: {formatBytes(total)}
                        {counted < selectedResolvedIds.size && (
                          <span className="text-muted-foreground/60"> ({counted}/{selectedResolvedIds.size} estimated)</span>
                        )}
                      </span>
                    )
                  }
                  return null
                })()}
                {estimating && (
                  <span className="block text-xs flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Estimating download sizes...
                  </span>
                )}
              </div>
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
            <Button onClick={handleDownload} disabled={downloading || resolving || selectedResolvedIds.size === 0}>
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
