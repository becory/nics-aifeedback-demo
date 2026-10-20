import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSubmitGuard } from './useSubmitGuard'

function deferred() {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useSubmitGuard', () => {
  it('starts not submitting', () => {
    const { result } = renderHook(() => useSubmitGuard())
    expect(result.current[0]).toBe(false)
  })

  it('sets submitting while the handler runs and clears it after it resolves', async () => {
    const { result } = renderHook(() => useSubmitGuard())
    const d = deferred()
    let done!: Promise<void>
    act(() => {
      done = result.current[1](() => d.promise)
    })
    expect(result.current[0]).toBe(true)

    await act(async () => {
      d.resolve()
      await done
    })
    expect(result.current[0]).toBe(false)
  })

  it('ignores a second call while the first is in flight', async () => {
    const { result } = renderHook(() => useSubmitGuard())
    const d = deferred()
    const first = vi.fn(() => d.promise)
    const second = vi.fn(() => Promise.resolve())
    let done!: Promise<void>
    await act(async () => {
      done = result.current[1](first)
      await result.current[1](second)
    })
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()

    await act(async () => {
      d.resolve()
      await done
    })
  })

  it('accepts a new call once the previous one has resolved', async () => {
    const { result } = renderHook(() => useSubmitGuard())
    const first = vi.fn(() => Promise.resolve())
    const second = vi.fn(() => Promise.resolve())
    await act(() => result.current[1](first))
    await act(() => result.current[1](second))
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('releases the guard and propagates the error when the handler rejects', async () => {
    const { result } = renderHook(() => useSubmitGuard())
    const d = deferred()
    let done!: Promise<void>
    act(() => {
      done = result.current[1](() => d.promise)
    })
    expect(result.current[0]).toBe(true)

    const error = new Error('boom')
    await act(async () => {
      d.reject(error)
      await expect(done).rejects.toBe(error)
    })
    expect(result.current[0]).toBe(false)

    const next = vi.fn(() => Promise.resolve())
    await act(() => result.current[1](next))
    expect(next).toHaveBeenCalledTimes(1)
  })
})
