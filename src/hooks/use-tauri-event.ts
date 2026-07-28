import { useEffect, useCallback } from "react"

type TauriEventCallback = (event: { payload: unknown }) => void

export function useTauriEvent(
  eventName: string,
  handler: TauriEventCallback
) {
  const stableHandler = useCallback(handler, [handler])

  useEffect(() => {
    let unlisten: (() => void) | undefined

    async function listen() {
      const { listen } = await import("@tauri-apps/api/event")
      unlisten = await listen(eventName, stableHandler)
    }

    listen()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [eventName, stableHandler])
}
