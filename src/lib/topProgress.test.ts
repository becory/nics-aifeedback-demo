import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attachTopProgress } from './topProgress'

const pending = vi.hoisted(() => ({ count: 0, listeners: new Set<() => void>() }))

vi.mock('../api/api', () => ({
  getPendingRequestCount: () => pending.count,
  subscribePendingRequests: (listener: () => void) => {
    pending.listeners.add(listener)
    return () => {
      pending.listeners.delete(listener)
    }
  },
}))

const setPending = (count: number) => {
  pending.count = count
  pending.listeners.forEach((listener) => listener())
}

const VISIBLE = 'cf-top-progress--visible'

const scale = (bar: HTMLElement) => {
  const match = /^scaleX\((.+)\)$/.exec(bar.style.transform)
  return match ? Number(match[1]) : undefined
}

describe('attachTopProgress', () => {
  let wrap: HTMLDivElement
  let bar: HTMLDivElement
  let detach: () => void

  const attach = () => {
    detach = attachTopProgress(wrap, bar)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    pending.count = 0
    pending.listeners.clear()
    wrap = document.createElement('div')
    bar = document.createElement('div')
    detach = () => {}
  })

  afterEach(() => {
    detach()
    vi.useRealTimers()
  })

  it('stays hidden when idle', () => {
    attach()
    vi.advanceTimersByTime(5000)
    expect(wrap.classList.contains(VISIBLE)).toBe(false)
    expect(bar.style.transform).toBe('')
  })

  it('does not show for a request that finishes within the show delay', () => {
    attach()
    setPending(1)
    vi.advanceTimersByTime(299)
    setPending(0)
    vi.advanceTimersByTime(5000)
    expect(wrap.classList.contains(VISIBLE)).toBe(false)
    expect(bar.style.transform).toBe('')
  })

  it('shows at the start value once a request outlasts the show delay', () => {
    attach()
    setPending(1)
    vi.advanceTimersByTime(299)
    expect(wrap.classList.contains(VISIBLE)).toBe(false)
    vi.advanceTimersByTime(1)
    expect(wrap.classList.contains(VISIBLE)).toBe(true)
    expect(scale(bar)).toBeCloseTo(0.3)
  })

  it('picks up requests already pending when attached', () => {
    pending.count = 1
    attach()
    vi.advanceTimersByTime(300)
    expect(wrap.classList.contains(VISIBLE)).toBe(true)
  })

  it('trickles upward but never past 90% while requests are pending', () => {
    attach()
    setPending(1)
    vi.advanceTimersByTime(300)
    let previous = scale(bar)!
    for (let i = 0; i < 200; i++) {
      vi.advanceTimersByTime(300)
      const current = scale(bar)!
      expect(current).toBeGreaterThan(previous)
      expect(current).toBeLessThanOrEqual(0.9)
      previous = current
    }
    expect(previous).toBeCloseTo(0.9, 3)
  })

  it('does not restart the delay for overlapping requests and only finishes when all are done', () => {
    attach()
    setPending(1)
    vi.advanceTimersByTime(200)
    setPending(2)
    vi.advanceTimersByTime(100)
    expect(wrap.classList.contains(VISIBLE)).toBe(true)

    vi.advanceTimersByTime(900)
    const beforeFirstDone = scale(bar)!
    setPending(1)
    expect(scale(bar)).toBe(beforeFirstDone)
    vi.advanceTimersByTime(300)
    expect(scale(bar)).toBeGreaterThan(beforeFirstDone)
    expect(scale(bar)).toBeLessThan(1)

    setPending(0)
    expect(scale(bar)).toBe(1)
  })

  it('fills to 100%, fades out, then resets to 0 without animating', () => {
    attach()
    setPending(1)
    vi.advanceTimersByTime(600)
    setPending(0)
    expect(scale(bar)).toBe(1)
    expect(wrap.classList.contains(VISIBLE)).toBe(true)

    vi.advanceTimersByTime(200)
    expect(wrap.classList.contains(VISIBLE)).toBe(false)
    expect(scale(bar)).toBe(1)

    vi.advanceTimersByTime(300)
    expect(scale(bar)).toBe(0)
    expect(bar.style.transition).toBe('')
  })

  it('stops trickling once finished', () => {
    attach()
    setPending(1)
    vi.advanceTimersByTime(600)
    setPending(0)
    vi.advanceTimersByTime(150)
    expect(scale(bar)).toBe(1)
  })

  it('starts from the beginning again for a request after the bar has fully hidden', () => {
    attach()
    setPending(1)
    vi.advanceTimersByTime(600)
    setPending(0)
    vi.advanceTimersByTime(500)

    setPending(1)
    vi.advanceTimersByTime(299)
    expect(wrap.classList.contains(VISIBLE)).toBe(false)
    vi.advanceTimersByTime(1)
    expect(wrap.classList.contains(VISIBLE)).toBe(true)
    expect(scale(bar)).toBeCloseTo(0.3)
  })

  it('resumes immediately from just under the cap when a request arrives while finishing', () => {
    attach()
    setPending(1)
    vi.advanceTimersByTime(600)
    setPending(0)
    vi.advanceTimersByTime(250) // faded class removed, not yet reset

    setPending(1)
    expect(wrap.classList.contains(VISIBLE)).toBe(true)
    expect(scale(bar)).toBe(0.9)

    // The pending hide must not fire and reset the bar mid-run.
    vi.advanceTimersByTime(1000)
    expect(wrap.classList.contains(VISIBLE)).toBe(true)
    expect(scale(bar)).toBeGreaterThan(0)
    expect(scale(bar)).toBeLessThanOrEqual(0.9)
  })

  it('unsubscribes and clears its timers on cleanup', () => {
    attach()
    setPending(1)
    vi.advanceTimersByTime(600)
    const shown = scale(bar)
    detach()
    expect(pending.listeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)

    setPending(0)
    vi.advanceTimersByTime(5000)
    expect(scale(bar)).toBe(shown)
    expect(wrap.classList.contains(VISIBLE)).toBe(true)
  })

  it('cancels a pending show on cleanup', () => {
    attach()
    setPending(1)
    detach()
    vi.advanceTimersByTime(1000)
    expect(wrap.classList.contains(VISIBLE)).toBe(false)
  })
})
