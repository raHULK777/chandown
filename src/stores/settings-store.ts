import { create } from "zustand"
import { persist } from "zustand/middleware"

interface SettingsStore {
  theme: "light" | "dark" | "system"
  downloadDirectory: string
  maxConcurrentDownloads: number
  defaultVideoQuality: string
  defaultAudioFormat: string
  cookiesFile: string
  setTheme: (theme: "light" | "dark" | "system") => void
  setDownloadDirectory: (dir: string) => void
  setMaxConcurrentDownloads: (max: number) => void
  setDefaultVideoQuality: (quality: string) => void
  setDefaultAudioFormat: (format: string) => void
  setCookiesFile: (path: string) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: "system",
      downloadDirectory: "",
      maxConcurrentDownloads: 3,
      defaultVideoQuality: "1080p",
      defaultAudioFormat: "mp3",
      cookiesFile: "",
      setTheme: (theme) => set({ theme }),
      setDownloadDirectory: (dir) => set({ downloadDirectory: dir }),
      setMaxConcurrentDownloads: (max) => set({ maxConcurrentDownloads: max }),
      setDefaultVideoQuality: (quality) => set({ defaultVideoQuality: quality }),
      setDefaultAudioFormat: (format) => set({ defaultAudioFormat: format }),
      setCookiesFile: (path) => set({ cookiesFile: path }),
    }),
    {
      name: "clipdown-settings",
    }
  )
)
