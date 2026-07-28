import { useCallback } from "react"

export function useTauriCommand() {
  const invoke = useCallback(async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core")
    return tauriInvoke<T>(command, args)
  }, [])

  return { invoke }
}
