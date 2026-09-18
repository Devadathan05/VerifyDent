import { useEffect, useState } from 'react'

import { fetchHealth } from '../services/api'
import type { ConnectionStatus, HealthResponse } from '../types/health'

export function useHealth() {
  const [status, setStatus] = useState<ConnectionStatus>('checking')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const data = await fetchHealth()
        if (cancelled) return
        setHealth(data)
        setStatus('online')
        setError(null)
      } catch (err) {
        if (cancelled) return
        setStatus('offline')
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [])

  return { status, health, error }
}