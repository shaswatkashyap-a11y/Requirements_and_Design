import { useEffect, useRef, useCallback } from 'react'
import { fetchLLDRun } from '../api/lldApi'

const POLL_INTERVAL_MS = 3000
const TERMINAL_STATUSES = new Set(['completed', 'failed'])

export function useLLDPolling({ runId, enabled = true, onUpdate, onDone }) {
  const timerRef   = useRef(null)
  const stoppedRef = useRef(false)

  const stop = useCallback(() => {
    stoppedRef.current = true
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!runId || !enabled) return

    stoppedRef.current = false

    const poll = async () => {
      if (stoppedRef.current) return
      try {
        const run = await fetchLLDRun(runId)
        onUpdate?.(run)
        if (TERMINAL_STATUSES.has(run.status)) {
          onDone?.(run)
          return
        }
      } catch {
        // network blip — keep polling
      }
      if (!stoppedRef.current) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    poll()
    return stop
  }, [runId, enabled, onUpdate, onDone, stop])

  return { stop }
}
