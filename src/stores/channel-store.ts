import { create } from "zustand"
import type { ChannelInfo, VideoItem, PlaylistItem } from "@/types"

interface ChannelStore {
  channel: ChannelInfo | null
  channelUrl: string
  videos: VideoItem[]
  shorts: VideoItem[]
  streams: VideoItem[]
  playlists: PlaylistItem[]
  loading: boolean
  error: string | null
  selectedIds: Set<string>
  activeTab: "videos" | "shorts" | "streams" | "playlists"
  setChannel: (channel: ChannelInfo) => void
  setChannelUrl: (url: string) => void
  setVideos: (videos: VideoItem[]) => void
  setShorts: (shorts: VideoItem[]) => void
  setStreams: (streams: VideoItem[]) => void
  setPlaylists: (playlists: PlaylistItem[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setActiveTab: (tab: "videos" | "shorts" | "streams" | "playlists") => void
  toggleSelection: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  reset: () => void
}

export const useChannelStore = create<ChannelStore>((set) => ({
  channel: null,
  channelUrl: "",
  videos: [],
  shorts: [],
  streams: [],
  playlists: [],
  loading: false,
  error: null,
  selectedIds: new Set(),
  activeTab: "videos",
  setChannel: (channel) => set({ channel }),
  setChannelUrl: (url) => set({ channelUrl: url }),
  setVideos: (videos) => set({ videos }),
  setShorts: (shorts) => set({ shorts }),
  setStreams: (streams) => set({ streams }),
  setPlaylists: (playlists) => set({ playlists }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { selectedIds: next }
    }),
  selectAll: () =>
    set((state) => {
      const items = getCurrentTabItems(state)
      const ids = new Set(items.map((i) => i.id))
      return { selectedIds: ids }
    }),
  clearSelection: () => set({ selectedIds: new Set() }),
  reset: () =>
    set({
      channel: null,
      channelUrl: "",
      videos: [],
      shorts: [],
      streams: [],
      playlists: [],
      loading: false,
      error: null,
      selectedIds: new Set(),
      activeTab: "videos",
    }),
}))

function getCurrentTabItems(state: ChannelStore): { id: string }[] {
  switch (state.activeTab) {
    case "videos":
      return state.videos
    case "shorts":
      return state.shorts
    case "streams":
      return state.streams
    case "playlists":
      return state.playlists
    default:
      return []
  }
}
