import { useState, useEffect, useRef } from 'react'
import { fetchGenerationStatus } from '../api/generationApi'

const TERMINAL_STATUSES = ['completed', 'failed']

export default function useGenerationPolling(runId, intervalMs = 3000) {
  const [run, setRun] = useState(null)
  const [isPolling, setIsPolling] = useState(true)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!runId) return

    async function poll() {
      try {
        const data = await fetchGenerationStatus(runId)
        setRun(data)
        if (TERMINAL_STATUSES.includes(data.status)) {
          setIsPolling(false)
          clearInterval(intervalRef.current)
        }
      } catch (err) {
        setError(err.message)
      }
    }

    // Fetch immediately, then on interval
    poll()
    intervalRef.current = setInterval(poll, intervalMs)

    return () => clearInterval(intervalRef.current)
  }, [runId, intervalMs])

  function stopPolling() {
    setIsPolling(false)
    clearInterval(intervalRef.current)
  }

  function restartPolling() {
    setIsPolling(true)
  }

  return { run, isPolling, error, stopPolling, restartPolling }
}
