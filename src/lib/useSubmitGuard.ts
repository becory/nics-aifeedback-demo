import { useCallback, useRef, useState } from 'react'

/**
 * Runs a submit handler at most once at a time. A second call while the first is still in flight
 * is dropped — this is what stops a double-click on 儲存 from sending two create requests (the
 * backend's "code already in use" check is a read-then-write, so two concurrent creates can both
 * pass it). The ref blocks even clicks landing before React re-renders the disabled button.
 */
export function useSubmitGuard(): [submitting: boolean, run: (handler: () => Promise<unknown>) => Promise<void>] {
  const inFlight = useRef(false)
  const [submitting, setSubmitting] = useState(false)

  const run = useCallback(async (handler: () => Promise<unknown>) => {
    if (inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    try {
      await handler()
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }, [])

  return [submitting, run]
}
