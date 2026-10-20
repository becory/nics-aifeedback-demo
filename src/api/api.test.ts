import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ApiModule = typeof import('./api')

// A reply for one request: a status (2xx resolves, anything else rejects like axios' own
// adapters do) and an optional body. A promise lets a test hold a request open.
type Reply = { status: number; data?: unknown }
type Responder = (config: InternalAxiosRequestConfig) => Reply | Promise<Reply>

let api: ApiModule
let adapter: ReturnType<typeof vi.fn<(config: InternalAxiosRequestConfig) => Promise<AxiosResponse>>>

function useResponder(responder: Responder) {
  adapter.mockImplementation(async (config) => {
    const { status, data } = await responder(config)
    const response: AxiosResponse = { status, statusText: String(status), data, headers: {}, config }
    if (status >= 200 && status < 300) return response
    throw new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_REQUEST, config, null, response)
  })
}

const authHeaderOf = (call: number) => adapter.mock.calls[call][0].headers.Authorization

function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function axiosErrorWithStatus(status: number, data: unknown = {}) {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig
  return new AxiosError<unknown>('failed', AxiosError.ERR_BAD_REQUEST, config, null, {
    status,
    statusText: String(status),
    data,
    headers: {},
    config,
  })
}

beforeEach(async () => {
  // A fresh module each test: token, handlers, the shared refresh and the pending count are
  // module state, and the interceptors are registered on import.
  vi.resetModules()
  api = await import('./api')
  adapter = vi.fn()
  api.instance.defaults.adapter = adapter
  useResponder(() => ({ status: 200, data: 'ok' }))
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-20T00:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Authorization header', () => {
  it('sends the current access token as a Bearer token', async () => {
    api.setAccessToken('token-a', 900)
    await api.instance.get('/feedback')
    expect(authHeaderOf(0)).toBe('Bearer token-a')
  })

  it('sends no Authorization header without a token', async () => {
    await api.instance.get('/feedback')
    expect(authHeaderOf(0)).toBeUndefined()
  })

  it('stops sending the token once it is cleared', async () => {
    api.setAccessToken('token-a', 900)
    api.setAccessToken(null)
    await api.instance.get('/feedback')
    expect(authHeaderOf(0)).toBeUndefined()
  })
})

describe('early refresh before expiry', () => {
  it('refreshes first and sends the new token when the token expires within a minute', async () => {
    api.setAccessToken('old', 120)
    const refresh = vi.fn(async () => api.setAccessToken('new', 900))
    api.setRefreshHandler(refresh)

    vi.advanceTimersByTime(61_000)
    await api.instance.get('/feedback')

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(authHeaderOf(0)).toBe('Bearer new')
  })

  it('does not refresh while more than a minute is left', async () => {
    api.setAccessToken('old', 120)
    const refresh = vi.fn(async () => api.setAccessToken('new', 900))
    api.setRefreshHandler(refresh)

    vi.advanceTimersByTime(59_000)
    await api.instance.get('/feedback')

    expect(refresh).not.toHaveBeenCalled()
    expect(authHeaderOf(0)).toBe('Bearer old')
  })

  it('never refreshes early when the token came without an expiry', async () => {
    api.setAccessToken('old')
    const refresh = vi.fn(async () => undefined)
    api.setRefreshHandler(refresh)

    vi.advanceTimersByTime(24 * 60 * 60 * 1000)
    await api.instance.get('/feedback')

    expect(refresh).not.toHaveBeenCalled()
  })

  it('keeps the original expiry when the same token is re-synced without one', async () => {
    api.setAccessToken('old', 120)
    vi.advanceTimersByTime(30_000)
    api.setAccessToken('old')
    const refresh = vi.fn(async () => api.setAccessToken('new', 900))
    api.setRefreshHandler(refresh)

    vi.advanceTimersByTime(31_000)
    await api.instance.get('/feedback')

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('shares one refresh between concurrent requests', async () => {
    api.setAccessToken('old', 30)
    const gate = deferred()
    const refresh = vi.fn(async () => {
      await gate.promise
      api.setAccessToken('new', 900)
    })
    api.setRefreshHandler(refresh)

    const requests = Promise.all([api.instance.get('/a'), api.instance.get('/b'), api.instance.get('/c')])
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
    gate.resolve()
    await requests

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(adapter.mock.calls.map((c) => c[0].headers.Authorization)).toEqual([
      'Bearer new',
      'Bearer new',
      'Bearer new',
    ])
  })

  it('still sends the request with the old token when the early refresh fails', async () => {
    api.setAccessToken('old', 30)
    const refresh = vi.fn(async () => {
      throw new Error('refresh failed')
    })
    api.setRefreshHandler(refresh)

    await expect(api.instance.get('/feedback')).resolves.toMatchObject({ data: 'ok' })
    expect(authHeaderOf(0)).toBe('Bearer old')
  })

  it('skips the early refresh for auth endpoints', async () => {
    api.setAccessToken('old', 30)
    const refresh = vi.fn(async () => api.setAccessToken('new', 900))
    api.setRefreshHandler(refresh)

    await api.instance.get('/auth/me')

    expect(refresh).not.toHaveBeenCalled()
    expect(authHeaderOf(0)).toBe('Bearer old')
  })
})

describe('401 handling', () => {
  it('refreshes once and retries the request with the new token', async () => {
    api.setAccessToken('old', 900)
    const refresh = vi.fn(async () => api.setAccessToken('new', 900))
    api.setRefreshHandler(refresh)
    useResponder((config) =>
      config.headers.Authorization === 'Bearer new' ? { status: 200, data: 'fresh' } : { status: 401 },
    )

    const response = await api.instance.get('/feedback')

    expect(response.data).toBe('fresh')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(adapter).toHaveBeenCalledTimes(2)
    expect(authHeaderOf(1)).toBe('Bearer new')
  })

  it('does not loop when the retried request is also rejected with 401', async () => {
    api.setAccessToken('old', 900)
    const refresh = vi.fn(async () => api.setAccessToken('new', 900))
    api.setRefreshHandler(refresh)
    useResponder(() => ({ status: 401 }))

    await expect(api.instance.get('/feedback')).rejects.toMatchObject({ response: { status: 401 } })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(adapter).toHaveBeenCalledTimes(2)
  })

  it('shares one refresh when several requests get 401 at once', async () => {
    api.setAccessToken('old', 900)
    const gate = deferred()
    const refresh = vi.fn(async () => {
      await gate.promise
      api.setAccessToken('new', 900)
    })
    api.setRefreshHandler(refresh)
    useResponder((config) =>
      config.headers.Authorization === 'Bearer new' ? { status: 200, data: config.url } : { status: 401 },
    )

    const requests = Promise.all([api.instance.get('/a'), api.instance.get('/b')])
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
    gate.resolve()
    const responses = await requests

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(responses.map((r) => r.data)).toEqual(['/a', '/b'])
  })

  it('resends without another refresh when the token already changed after the request went out', async () => {
    api.setAccessToken('old', 900)
    const refresh = vi.fn(async () => api.setAccessToken('newer', 900))
    api.setRefreshHandler(refresh)
    const firstReply = deferred()
    let calls = 0
    useResponder(async (config) => {
      calls += 1
      if (calls === 1) {
        await firstReply.promise
        return { status: 401 }
      }
      return { status: 200, data: config.headers.Authorization }
    })

    const request = api.instance.get('/feedback')
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1))
    // Another part of the app refreshed the token while this request was in flight.
    api.setAccessToken('new', 900)
    firstReply.resolve()

    await expect(request).resolves.toMatchObject({ data: 'Bearer new' })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('calls the unauthorized handler and rejects with the refresh error when the refresh fails', async () => {
    api.setAccessToken('old', 900)
    const refreshError = new Error('refresh failed')
    api.setRefreshHandler(vi.fn(async () => Promise.reject(refreshError)))
    const onUnauthorized = vi.fn()
    api.setOnUnauthorized(onUnauthorized)
    useResponder(() => ({ status: 401 }))

    await expect(api.instance.get('/feedback')).rejects.toBe(refreshError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it.each(['/auth/login', '/auth/2fa/verify', '/auth/refresh', '/auth/me'])(
    'passes a 401 from %s straight through without refreshing',
    async (url) => {
      api.setAccessToken('old', 900)
      const refresh = vi.fn(async () => api.setAccessToken('new', 900))
      api.setRefreshHandler(refresh)
      const onUnauthorized = vi.fn()
      api.setOnUnauthorized(onUnauthorized)
      useResponder(() => ({ status: 401 }))

      await expect(api.instance.post(url)).rejects.toMatchObject({ response: { status: 401 } })
      expect(refresh).not.toHaveBeenCalled()
      expect(onUnauthorized).not.toHaveBeenCalled()
      expect(adapter).toHaveBeenCalledTimes(1)
    },
  )

  it('does not refresh on errors other than 401', async () => {
    api.setAccessToken('old', 900)
    const refresh = vi.fn(async () => undefined)
    api.setRefreshHandler(refresh)
    useResponder(() => ({ status: 403 }))

    await expect(api.instance.get('/feedback')).rejects.toMatchObject({ response: { status: 403 } })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('passes a 401 through when no refresh handler is registered', async () => {
    api.setAccessToken('old', 900)
    useResponder(() => ({ status: 401 }))

    await expect(api.instance.get('/feedback')).rejects.toMatchObject({ response: { status: 401 } })
    expect(adapter).toHaveBeenCalledTimes(1)
  })
})

describe('refreshNow', () => {
  it('resolves without doing anything when no refresh handler is registered', async () => {
    await expect(api.refreshNow()).resolves.toBeUndefined()
  })

  it('shares the refresh already started by a request', async () => {
    api.setAccessToken('old', 30)
    const gate = deferred()
    const refresh = vi.fn(async () => {
      await gate.promise
      api.setAccessToken('new', 900)
    })
    api.setRefreshHandler(refresh)

    const request = api.instance.get('/feedback')
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled())
    const keepAlive = api.refreshNow()
    gate.resolve()
    await Promise.all([request, keepAlive])

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('signs out when the refresh is rejected with 401', async () => {
    const error = axiosErrorWithStatus(401)
    api.setRefreshHandler(vi.fn(async () => Promise.reject(error)))
    const onUnauthorized = vi.fn()
    api.setOnUnauthorized(onUnauthorized)

    await expect(api.refreshNow()).rejects.toBe(error)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('does not sign out when the refresh fails for another reason', async () => {
    const error = axiosErrorWithStatus(503)
    api.setRefreshHandler(vi.fn(async () => Promise.reject(error)))
    const onUnauthorized = vi.fn()
    api.setOnUnauthorized(onUnauthorized)

    await expect(api.refreshNow()).rejects.toBe(error)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('starts a new refresh after the previous one settled', async () => {
    const refresh = vi.fn(async () => undefined)
    api.setRefreshHandler(refresh)

    await api.refreshNow()
    await api.refreshNow()

    expect(refresh).toHaveBeenCalledTimes(2)
  })
})

describe('pending request count', () => {
  it('counts a request while in flight and notifies subscribers', async () => {
    const gate = deferred()
    useResponder(async () => {
      await gate.promise
      return { status: 200 }
    })
    const listener = vi.fn()
    api.subscribePendingRequests(listener)

    const request = api.instance.get('/feedback')
    await vi.waitFor(() => expect(api.getPendingRequestCount()).toBe(1))
    gate.resolve()
    await request

    expect(api.getPendingRequestCount()).toBe(0)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('returns to zero after a failed request', async () => {
    useResponder(() => ({ status: 500 }))
    await expect(api.instance.get('/feedback')).rejects.toBeInstanceOf(AxiosError)
    expect(api.getPendingRequestCount()).toBe(0)
  })

  it('counts a 401 retry as one request until it settles', async () => {
    api.setAccessToken('old', 900)
    api.setRefreshHandler(vi.fn(async () => api.setAccessToken('new', 900)))
    useResponder((config) => (config.headers.Authorization === 'Bearer new' ? { status: 200 } : { status: 401 }))

    await api.instance.get('/feedback')

    expect(api.getPendingRequestCount()).toBe(0)
  })

  it('stops notifying after unsubscribing', async () => {
    const listener = vi.fn()
    const unsubscribe = api.subscribePendingRequests(listener)
    unsubscribe()

    await api.instance.get('/feedback')

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('getApiErrorMessage', () => {
  const errorWithBody = (data: unknown) => axiosErrorWithStatus(400, data)

  it('returns the message of an API error', () => {
    expect(api.getApiErrorMessage(errorWithBody({ message: '名稱已存在' }))).toBe('名稱已存在')
  })

  it('appends field-level errors after the message, skipping non-strings', () => {
    expect(
      api.getApiErrorMessage(errorWithBody({ message: '驗證失敗', errors: ['名稱必填', 42, '分數超出範圍'] })),
    ).toBe('驗證失敗 名稱必填 分數超出範圍')
  })

  it('uses the field errors alone when there is no message', () => {
    expect(api.getApiErrorMessage(errorWithBody({ errors: ['名稱必填'] }))).toBe('名稱必填')
  })

  it('returns undefined for a body without message or errors', () => {
    expect(api.getApiErrorMessage(errorWithBody({ message: 123, errors: 'nope' }))).toBeUndefined()
  })

  it('returns undefined for a missing or non-object body', () => {
    expect(api.getApiErrorMessage(errorWithBody(undefined))).toBeUndefined()
    expect(api.getApiErrorMessage(errorWithBody('Bad Request'))).toBeUndefined()
  })

  it('returns undefined when there is no response at all', () => {
    expect(api.getApiErrorMessage(new AxiosError('Network Error', AxiosError.ERR_NETWORK))).toBeUndefined()
  })

  it('returns undefined for errors that are not from axios', () => {
    expect(api.getApiErrorMessage(new Error('boom'))).toBeUndefined()
    expect(api.getApiErrorMessage({ response: { data: { message: 'x' } } })).toBeUndefined()
  })
})

describe('serializeRepeatedParams', () => {
  it('repeats the key once per array element', () => {
    expect(api.serializeRepeatedParams({ eventType: ['login', 'logout'] })).toBe('eventType=login&eventType=logout')
  })

  it('skips undefined and null values, including inside arrays', () => {
    expect(
      api.serializeRepeatedParams({ a: undefined, b: null, c: ['x', null, undefined, 'y'], d: 0, e: false }),
    ).toBe('c=x&c=y&d=0&e=false')
  })

  it('encodes values', () => {
    expect(api.serializeRepeatedParams({ q: 'a b&c', page: 2 })).toBe('q=a+b%26c&page=2')
  })

  it('returns an empty string for no params or an empty array', () => {
    expect(api.serializeRepeatedParams({})).toBe('')
    expect(api.serializeRepeatedParams({ tags: [] })).toBe('')
  })
})
