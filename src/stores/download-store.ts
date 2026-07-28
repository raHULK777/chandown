import { create } from "zustand"
import type { DownloadItem, QueueState } from "@/types"

interface DownloadStore {
  queue: DownloadItem[]
  activeCount: number
  maxConcurrent: number
  setQueue: (state: QueueState) => void
  addItem: (item: DownloadItem) => void
  updateItem: (id: string, updates: Partial<DownloadItem>) => void
  removeItem: (id: string) => void
  clearCompleted: () => void
}

export const useDownloadStore = create<DownloadStore>((set) => ({
  queue: [],
  activeCount: 0,
  maxConcurrent: 3,
  setQueue: (state) =>
    set({
      queue: state.items,
      activeCount: state.active_count,
      maxConcurrent: state.max_concurrent,
    }),
  addItem: (item) =>
    set((state) => ({ queue: [...state.queue, item] })),
  updateItem: (id, updates) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),
  removeItem: (id) =>
    set((state) => ({
      queue: state.queue.filter((item) => item.id !== id),
    })),
  clearCompleted: () =>
    set((state) => ({
      queue: state.queue.filter(
        (item) => item.status !== "Completed" && item.status !== "Cancelled"
      ),
    })),
}))
