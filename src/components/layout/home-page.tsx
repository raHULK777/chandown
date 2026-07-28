import { useState, useEffect, useCallback, useMemo } from "react"
import { useChannelStore } from "@/stores/channel-store"
import { useTauriCommand } from "@/hooks/use-tauri-command"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DownloadDialog } from "@/components/download/download-dialog"
import type { ChannelInfo, VideoItem, PlaylistItem } from "@/types"
import { Search, X } from "lucide-react"

const PAGE_SIZE = 20

function friendlyMessage(msg: string): { title: string; body: string } | null {
  if (msg.includes("Sign in to confirm") || msg.includes("not a bot") || msg.includes("cookies") || msg.includes("Failed to decrypt") || msg.includes("DPAPI")) {
    return { title: "YouTube requires authentication", body: "" }
  }
  if (msg.includes("does not have a shorts tab")) {
    return { title: "No shorts available", body: "This channel does not have a shorts tab." }
  }
  if (msg.includes("does not have a streams tab")) {
    return { title: "No streams available", body: "This channel does not have a streams tab." }
  }
  if (msg.includes("does not have a videos tab")) {
    return { title: "No videos available", body: "This channel does not have a videos tab." }
  }
  if (msg.includes("does not have a playlists tab")) {
    return { title: "No playlists available", body: "This channel does not have a playlists tab." }
  }
  return null
}

function SettingsLink() {
  const goToSettings = () => window.dispatchEvent(new CustomEvent("navigate", { detail: "settings" }))
  return <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={goToSettings}>Settings →</Button>
}

function HomePage() {
  const [url, setUrl] = useState("")
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const { invoke } = useTauriCommand()
  const store = useChannelStore()

  const isValidUrl = (u: string) => {
    return /^https?:\/\/(www\.)?youtube\.com\/(@|channel\/|c\/|user\/)/i.test(u.trim())
  }

  const fetchTabData = useCallback(async (tab: string) => {
    const channelUrl = store.channelUrl || url.trim().replace(/\/?(videos|shorts|streams|playlists)?\/?$/, "")
    try {
      const videos = await invoke<VideoItem[]>("fetch_channel_videos", {
        channelUrl,
        tab,
        limit: 50,
      })
      if (tab === "shorts") store.setShorts(videos)
      else if (tab === "streams") store.setStreams(videos)
      else store.setVideos(videos)
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      const friendly = friendlyMessage(raw)
      store.setError(friendly ? `${friendly.title}: ${friendly.body}` : raw)
    }
  }, [url, invoke, store.channelUrl])

  useEffect(() => {
    if (!store.channel) return
    if (store.activeTab === "shorts" && store.shorts.length === 0) {
      fetchTabData("shorts")
    } else if (store.activeTab === "streams" && store.streams.length === 0) {
      fetchTabData("streams")
    }
  }, [store.activeTab, store.channel, fetchTabData])

  const handleFetch = useCallback(async () => {
    if (!isValidUrl(url)) return
    store.reset()
    store.setLoading(true)
    store.setError(null)

    try {
      const channelUrl = url.trim().replace(/\/?(videos|shorts|streams|playlists)?\/?$/, "")
      store.setChannelUrl(channelUrl)
      const channel = await invoke<ChannelInfo>("fetch_channel_info", { channelUrl })
      store.setChannel(channel)
      const videos = await invoke<VideoItem[]>("fetch_channel_videos", { channelUrl, tab: "videos", limit: 50 })
      store.setVideos(videos)
      const playlists = await invoke<PlaylistItem[]>("fetch_channel_playlists", { channelUrl })
      store.setPlaylists(playlists)
    } catch (err) {
      store.setError(err instanceof Error ? err.message : String(err))
    } finally {
      store.setLoading(false)
    }
  }, [url, invoke])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleFetch()
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Paste a YouTube channel URL (e.g. https://youtube.com/@channel)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                className={!isValidUrl(url) && url.length > 0 ? "border-destructive" : ""}
              />
              {!isValidUrl(url) && url.length > 0 && (
                <p className="mt-1 text-xs text-destructive">Enter a valid YouTube channel URL</p>
              )}
            </div>
            <Button onClick={handleFetch} disabled={!isValidUrl(url) || store.loading}>
              {store.loading ? "Loading..." : "Fetch"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {store.error && (
        <Card className={`border-destructive/50 ${friendlyMessage(store.error) ? "border-amber-500/50" : ""}`}>
          <CardContent className="pt-6 space-y-3">
            {(() => {
              const friendly = friendlyMessage(store.error)
              if (friendly && friendly.title === "YouTube requires authentication") {
                return (
                  <>
                    <p className="text-sm font-medium text-amber-600">{friendly.title}</p>
                    <p className="text-xs text-muted-foreground">
                      YouTube is blocking automated requests. You need to provide login cookies.
                    </p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                      <li>Install <span className="font-medium">Firefox</span>, log into YouTube, and restart the app</li>
                      <li>Or export a <span className="font-medium">cookies.txt</span> file using a browser extension and select it in <SettingsLink /></li>
                    </ul>
                  </>
                )
              }
              if (friendly) {
                return <p className="text-sm text-amber-600">{friendly.title}</p>
              }
              return <p className="text-sm text-destructive">{store.error}</p>
            })()}
            {!friendlyMessage(store.error) && store.error.includes("yt-dlp not found") && (
              <InstallYtdlpButton onInstalled={() => { store.setError(null); handleFetch() }} />
            )}
          </CardContent>
        </Card>
      )}

      {store.loading && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      )}

      {store.channel && !store.loading && (
        <>
          <Card>
            <CardContent className="flex items-start gap-4 pt-6">
              <img src={store.channel.thumbnail} alt={store.channel.title} className="h-16 w-16 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold truncate">{store.channel.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {store.channel.subscriber_count ? `${formatCount(store.channel.subscriber_count)} subscribers` : ""}
                  {store.channel.video_count ? ` · ${store.channel.video_count} videos` : ""}
                </p>
                {store.channel.description && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{store.channel.description}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-1 border-b">
            {(["videos", "shorts", "streams", "playlists"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => store.setActiveTab(tab)}
                className={`relative px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  store.activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
                {store.activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                  checked={store.selectedIds.size === getCurrentItems().length && getCurrentItems().length > 0}
                  onChange={() => {
                    if (store.selectedIds.size === getCurrentItems().length) store.clearSelection()
                    else store.selectAll()
                  }}
                />
                Select All
              </label>
              {store.selectedIds.size > 0 && (
                <span className="text-sm text-muted-foreground">{store.selectedIds.size} selected</span>
              )}
            </div>
            <Button size="sm" disabled={store.selectedIds.size === 0} onClick={() => setShowDownloadDialog(true)}>
              Download Selected
            </Button>
          </div>

          {store.activeTab === "playlists" ? (
            <PlaylistGrid playlists={store.playlists} />
          ) : (
            <VideoBrowser items={getCurrentItems()} />
          )}
        </>
      )}

      {!store.channel && !store.loading && !store.error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <img src="/ClipDownLogo.png" alt="ClipDown" className="h-12 w-12 mb-4" />
            <h3 className="text-lg font-medium">ClipDown</h3>
            <p className="text-sm text-muted-foreground mt-1">Paste a YouTube channel URL above to get started</p>
          </CardContent>
        </Card>
      )}

      {showDownloadDialog && <DownloadDialog onClose={() => setShowDownloadDialog(false)} />}
    </div>
  )

  function getCurrentItems(): VideoItem[] {
    switch (store.activeTab) {
      case "videos": return store.videos
      case "shorts": return store.shorts
      case "streams": return store.streams
      default: return []
    }
  }
}

function InstallYtdlpButton({ onInstalled }: { onInstalled: () => void }) {
  const [installing, setInstalling] = useState(false)
  const { invoke } = useTauriCommand()

  const handleInstall = async () => {
    setInstalling(true)
    try {
      await invoke("ensure_ytdlp")
      onInstalled()
    } catch { /* error already shown */ } finally {
      setInstalling(false)
    }
  }

  return (
    <Button size="sm" onClick={handleInstall} disabled={installing}>
      {installing ? "Installing..." : "Install yt-dlp"}
    </Button>
  )
}

function VideoGrid({ items }: { items: VideoItem[] }) {
  const store = useChannelStore()

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">No items found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.id} className="group relative rounded-lg border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="relative aspect-video overflow-hidden rounded-t-lg">
            <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
            {item.duration && (
              <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">
                {formatDuration(item.duration)}
              </span>
            )}
            <div className="absolute left-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                checked={store.selectedIds.has(item.id)}
                onChange={() => store.toggleSelection(item.id)}
              />
            </div>
          </div>
          <div className="p-2.5">
            <h4 className="truncate text-sm font-medium">{item.title}</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.view_count ? `${formatCount(item.view_count)} views` : ""}
              {item.upload_date ? ` · ${formatDate(item.upload_date)}` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function PlaylistGrid({ playlists }: { playlists: PlaylistItem[] }) {
  const store = useChannelStore()

  if (playlists.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">No playlists found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {playlists.map((playlist) => (
        <div key={playlist.id} className="group relative rounded-lg border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="relative aspect-video overflow-hidden rounded-t-lg bg-muted">
            {playlist.thumbnail ? (
              <img src={playlist.thumbnail} alt={playlist.title} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <span className="text-2xl">📋</span>
              </div>
            )}
            {playlist.video_count && (
              <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">
                {playlist.video_count} videos
              </span>
            )}
            <div className="absolute left-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                checked={store.selectedIds.has(playlist.id)}
                onChange={() => store.toggleSelection(playlist.id)}
              />
            </div>
          </div>
          <div className="p-2.5">
            <h4 className="truncate text-sm font-medium">{playlist.title}</h4>
            {playlist.upload_date && (
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(playlist.upload_date)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function VideoBrowser({ items }: { items: VideoItem[] }) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter((i) => i.title.toLowerCase().includes(q))
  }, [items, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const go = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)))

  const pages = useMemo(() => {
    const p: (number | "...")[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) p.push(i)
    } else {
      p.push(1)
      if (safePage > 3) p.push("...")
      const start = Math.max(2, safePage - 1)
      const end = Math.min(totalPages - 1, safePage + 1)
      for (let i = start; i <= end; i++) p.push(i)
      if (safePage < totalPages - 2) p.push("...")
      p.push(totalPages)
    }
    return p
  }, [totalPages, safePage])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by title..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          className="pl-8 pr-8"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setPage(1) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <VideoGrid items={pageItems} />
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => go(safePage - 1)}
            disabled={safePage <= 1}
            className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent disabled:opacity-30"
          >
            Prev
          </button>
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">...</span>
            ) : (
              <button
                key={p}
                onClick={() => go(p as number)}
                className={`min-w-[28px] rounded px-2 py-1 text-sm ${
                  p === safePage ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => go(safePage + 1)}
            disabled={safePage >= totalPages}
            className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  return `${m}:${s.toString().padStart(2, "0")}`
}

function formatDate(dateStr: string): string {
  if (dateStr.length >= 8) {
    const y = dateStr.substring(0, 4)
    const m = dateStr.substring(4, 6)
    const d = dateStr.substring(6, 8)
    return `${y}-${m}-${d}`
  }
  return dateStr
}

export { HomePage }
