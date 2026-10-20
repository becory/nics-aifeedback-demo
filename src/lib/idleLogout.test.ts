import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDLE_TIMEOUT_MS, useIdleLogout } from './idleLogout'

const STORAGE_KEY = 'aifeedback.lastActivity'
const MINUTE = 60 * 1000

const setup = (active = true) => {
  const onIdle = vi.fn()
  const keepAlive = vi.fn(() => Promise.resolve())
  const hook = renderHook(({ on }) => useIdleLogout(on, onIdle, keepAlive), {
    initialProps: { on: active },
  })
  return { onIdle, keepAlive, ...hook }
}

const activity = (type = 'mousemove') => window.dispatchEvent(new Event(type))

describe('useIdleLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-20T09:00:00Z'))
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it('calls onIdle once the idle timeout passes without activity, not before', () => {
    const { onIdle } = setup()
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - MINUTE)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(MINUTE)
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('does nothing while inactive', () => {
    const { onIdle, keepAlive } = setup(false)
    activity()
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS * 2)
    expect(onIdle).not.toHaveBeenCalled()
    expect(keepAlive).not.toHaveBeenCalled()
  })

  it.each(['mousemove', 'mousedown', 'keydown', 'scroll', 'wheel', 'touchstart'])(
    'treats a %s event as activity that restarts the idle countdown',
    (type) => {
      const { onIdle } = setup()
      vi.advanceTimersByTime(20 * MINUTE)
      activity(type)
      vi.advanceTimersByTime(20 * MINUTE)
      expect(onIdle).not.toHaveBeenCalled()
      vi.advanceTimersByTime(10 * MINUTE)
      expect(onIdle).toHaveBeenCalledTimes(1)
    },
  )

  it('ignores events that are not user activity', () => {
    const { onIdle } = setup()
    vi.advanceTimersByTime(20 * MINUTE)
    activity('resize')
    vi.advanceTimersByTime(10 * MINUTE)
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('records the start time and throttled activity in shared storage', () => {
    setup()
    const start = Date.now()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(String(start))

    vi.advanceTimersByTime(1000)
    activity()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(String(start + 1000))

    // Within the 5s throttle window the stored value stays put.
    vi.advanceTimersByTime(2000)
    activity()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(String(start + 1000))

    vi.advanceTimersByTime(3000)
    activity()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(String(start + 6000))
  })

  it('stays logged in while another tab reports recent activity', () => {
    const { onIdle } = setup()
    vi.advanceTimersByTime(20 * MINUTE)
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()))
    vi.advanceTimersByTime(20 * MINUTE)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10 * MINUTE)
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('falls back to its own activity when shared storage holds garbage', () => {
    const { onIdle } = setup()
    window.localStorage.setItem(STORAGE_KEY, 'not-a-number')
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS)
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('does not call keepAlive when this tab has had no activity', () => {
    const { keepAlive } = setup()
    vi.advanceTimersByTime(10 * MINUTE)
    expect(keepAlive).not.toHaveBeenCalled()
  })

  it('does not call keepAlive for activity that only happened in another tab', () => {
    const { keepAlive } = setup()
    vi.advanceTimersByTime(30 * 1000)
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()))
    vi.advanceTimersByTime(5 * MINUTE)
    expect(keepAlive).not.toHaveBeenCalled()
  })

  it('calls keepAlive at most about once a minute while the user is active', () => {
    const { keepAlive } = setup()
    vi.advanceTimersByTime(10 * 1000)
    activity()
    vi.advanceTimersByTime(45 * 1000)
    expect(keepAlive).not.toHaveBeenCalled()
    vi.advanceTimersByTime(15 * 1000)
    expect(keepAlive).toHaveBeenCalledTimes(1)

    // Activity right after the keep-alive waits for the next minute to elapse.
    activity()
    vi.advanceTimersByTime(45 * 1000)
    expect(keepAlive).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(15 * 1000)
    expect(keepAlive).toHaveBeenCalledTimes(2)

    // No new activity: no further keep-alive.
    vi.advanceTimersByTime(5 * MINUTE)
    expect(keepAlive).toHaveBeenCalledTimes(2)
  })

  it('swallows a failed keepAlive without throwing or logging out', async () => {
    const onIdle = vi.fn()
    const keepAlive = vi.fn(() => Promise.reject(new Error('network')))
    renderHook(() => useIdleLogout(true, onIdle, keepAlive))
    vi.advanceTimersByTime(1000)
    activity()
    await vi.advanceTimersByTimeAsync(60 * 1000)
    expect(keepAlive).toHaveBeenCalledTimes(1)
    expect(onIdle).not.toHaveBeenCalled()
  })

  it('stops checking and listening after unmount', () => {
    const { onIdle, keepAlive, unmount } = setup()
    activity()
    unmount()

    window.localStorage.clear()
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS * 2)
    for (const type of ['mousemove', 'mousedown', 'keydown', 'scroll', 'wheel', 'touchstart']) activity(type)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(onIdle).not.toHaveBeenCalled()
    expect(keepAlive).not.toHaveBeenCalled()
  })

  it('stops when it becomes inactive and restarts the countdown when active again', () => {
    const { onIdle, rerender } = setup()
    vi.advanceTimersByTime(20 * MINUTE)
    rerender({ on: false })
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS)
    expect(onIdle).not.toHaveBeenCalled()

    rerender({ on: true })
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - MINUTE)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(MINUTE)
    expect(onIdle).toHaveBeenCalledTimes(1)
  })
})
