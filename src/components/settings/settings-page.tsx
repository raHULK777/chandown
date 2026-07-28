import { useState } from "react"
import { useSettingsStore } from "@/stores/settings-store"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTauriCommand } from "@/hooks/use-tauri-command"
import { FolderOpen, Trash2, Cookie, AlertCircle } from "lucide-react"

function SettingsPage() {
  const store = useSettingsStore()
  const { invoke } = useTauriCommand()
  const [ytdlpVersion, setYtdlpVersion] = useState<string | null>(null)
  const [ffmpegVersion, setFfmpegVersion] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [ytdlpPath, setYtdlpPath] = useState<string | null>(null)
  const [ffmpegPath, setFfmpegPath] = useState<string | null>(null)
  const [installingFfmpeg, setInstallingFfmpeg] = useState(false)

  const handleBrowseCookies = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog")
      const selected = await open({
        multiple: false,
        title: "Select cookies.txt file",
        filters: [{ name: "Cookies", extensions: ["txt"] }],
      })
      if (selected) {
        const path = selected as string
        store.setCookiesFile(path)
        await invoke("update_setting", { key: "cookies_file", value: path })
      }
    } catch { /* ignore */ }
  }

  const handleClearCookies = async () => {
    store.setCookiesFile("")
    await invoke("update_setting", { key: "cookies_file", value: "" })
  }

  const fetchVersion = async (tool: "ytdlp" | "ffmpeg") => {
    try {
      const version = await invoke<string>(`get_${tool}_version`)
      if (tool === "ytdlp") setYtdlpVersion(version)
      else setFfmpegVersion(version)
    } catch {
      if (tool === "ytdlp") setYtdlpVersion("Not found")
      else setFfmpegVersion("Not found")
    }
  }

  const handleEnsureYtdlp = async () => {
    setDownloading(true)
    try {
      const path = await invoke<string>("ensure_ytdlp")
      setYtdlpPath(path)
      const version = await invoke<string>("get_ytdlp_version")
      setYtdlpVersion(version)
    } catch (e) {
      setYtdlpVersion(`Error: ${e}`)
    } finally {
      setDownloading(false)
    }
  }

  const handleEnsureFfmpeg = async () => {
    setInstallingFfmpeg(true)
    try {
      const path = await invoke<string>("ensure_ffmpeg")
      setFfmpegPath(path)
      const version = await invoke<string>("get_ffmpeg_version")
      setFfmpegVersion(version)
    } catch (e) {
      setFfmpegVersion(`Error: ${e}`)
    } finally {
      setInstallingFfmpeg(false)
    }
  }

  const handleUpdate = async () => {
    try {
      await invoke("update_ytdlp")
      fetchVersion("ytdlp")
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-sm font-medium">Appearance</h2>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => store.setTheme(t)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm capitalize transition-colors ${
                  store.theme === t ? "border-primary bg-primary/5 text-primary" : "border-input hover:bg-accent"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-sm font-medium">YouTube Authentication</h2>
          <p className="text-xs text-muted-foreground">
            YouTube requires login cookies to prevent bot blocks. Due to Chrome/Edge
            app-bound encryption (yt-dlp #10927), their cookies cannot be read even when
            the browser is closed. Use Firefox or export a cookies.txt file.
          </p>
          {store.cookiesFile ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <Cookie className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs text-muted-foreground flex-1">{store.cookiesFile}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClearCookies} title="Clear">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-green-600">
                <Cookie className="h-3.5 w-3.5" />
                cookies.txt loaded
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              No authentication configured
            </div>
          )}
          <div className="space-y-2">
            <Button variant="outline" size="sm" onClick={handleBrowseCookies} className="w-full sm:w-auto">
              <FolderOpen className="mr-2 h-4 w-4" />
              Select cookies.txt
            </Button>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Option 1 (recommended):</span> Install{" "}
              <span className="font-medium">Firefox</span>, log into YouTube, and the app will
              auto-detect your cookies.
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Option 2:</span> Install a browser extension like{" "}
              <span className="font-medium">Get cookies.txt LOCALLY</span> (Chrome/Edge/Firefox),
              log into YouTube, export your cookies to a <span className="font-medium">.txt</span> file,
              and select it above.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-sm font-medium">Download Location</h2>
          <div className="flex gap-2">
            <Input
              value={store.downloadDirectory}
              onChange={(e) => store.setDownloadDirectory(e.target.value)}
              placeholder="Default download location"
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-sm font-medium">Tools</h2>
          <p className="text-xs text-muted-foreground">
            The app needs yt-dlp to download content. FFmpeg is required for merging video+audio and format conversion.
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">yt-dlp</p>
                <p className="text-xs text-muted-foreground">
                  {ytdlpVersion ? ytdlpVersion : (ytdlpPath ? "Ready" : "Click 'Install' to download")}
                </p>
                {ytdlpPath && (
                  <p className="text-xs text-muted-foreground truncate max-w-[250px]">{ytdlpPath}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => fetchVersion("ytdlp")}>
                  Check
                </Button>
                {!ytdlpVersion || ytdlpVersion === "Not found" ? (
                  <Button size="sm" onClick={handleEnsureYtdlp} disabled={downloading}>
                    {downloading ? "Downloading..." : "Install yt-dlp"}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleUpdate}>
                    Update
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">FFmpeg</p>
                <p className="text-xs text-muted-foreground">
                  {ffmpegVersion ? ffmpegVersion : (ffmpegPath ? "Ready" : "Click 'Check' for status")}
                </p>
                {ffmpegPath && (
                  <p className="text-xs text-muted-foreground truncate max-w-[250px]">{ffmpegPath}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => fetchVersion("ffmpeg")}>
                  Check
                </Button>
                {!ffmpegVersion || ffmpegVersion === "Not found" ? (
                  <Button size="sm" onClick={handleEnsureFfmpeg} disabled={installingFfmpeg}>
                    {installingFfmpeg ? "Downloading..." : "Install FFmpeg"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-sm font-medium">Max Concurrent Downloads</h2>
          <Input
            type="number"
            min={1}
            max={10}
            value={store.maxConcurrentDownloads}
            onChange={(e) => store.setMaxConcurrentDownloads(parseInt(e.target.value) || 3)}
            className="w-24"
          />
        </CardContent>
      </Card>
    </div>
  )
}

export { SettingsPage }
