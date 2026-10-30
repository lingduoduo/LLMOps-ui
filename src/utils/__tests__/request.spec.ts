import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAccessToken, setCredential, SESSION_CLEARED_EVENT } from '../auth'
import { get, post } from '../request'

afterEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('request', () => {
  it('announces sign-out when the credential expires while a request is pending', async () => {
    vi.useFakeTimers()
    setCredential({ access_token: 'expiring-token', expire_at: Math.floor(Date.now() / 1000) + 1 })
    let finish!: (response: Response) => void
    const signedOut = vi.fn()
    window.addEventListener(SESSION_CLEARED_EVENT, signedOut)
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise<Response>((resolve) => {
              finish = resolve
            }),
        ),
      )
      const pending = get('/account')
      await vi.advanceTimersByTimeAsync(2000)
      finish(new Response('{"code":"unauthorized","message":"Expired","data":{}}'))
      await expect(pending).rejects.toThrow('Expired')
      expect(signedOut).toHaveBeenCalledOnce()
    } finally {
      window.removeEventListener(SESSION_CLEARED_EVENT, signedOut)
    }
  })

  it('attaches bearer credentials and clears the session for a business unauthorized response', async () => {
    setCredential({ access_token: 'test-token', expire_at: Math.floor(Date.now() / 1000) + 3600 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, options: RequestInit) => {
        expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-token')
        return new Response('{"code":"unauthorized","message":"Session expired","data":{}}')
      }),
    )
    await expect(get('/account')).rejects.toThrow('Session expired')
    expect(getAccessToken()).toBeNull()
  })

  it('propagates caller cancellation and cleans up the timeout', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
              once: true,
            })
          }),
      ),
    )
    const pending = get('/test', { signal: controller.signal })
    const result = expect(pending).rejects.toThrow('Cancelled')
    controller.abort(new Error('Cancelled'))
    await result
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects HTTP failures rather than returning their JSON as success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"message":"Unavailable"}', { status: 503 })),
    )
    await expect(get('/test')).rejects.toThrow('Unavailable')
  })

  it('clears the timeout after a successful response', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"value":1}')))
    await expect(get('/test')).resolves.toEqual({ value: 1 })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('aborts the network request when the timeout expires', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, options: RequestInit) => {
        signal = options.signal as AbortSignal
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(signal?.reason), { once: true })
        })
      }),
    )
    const result = expect(get('/test')).rejects.toThrow(/timed out/i)
    await vi.advanceTimersByTimeAsync(100000)
    await result
    expect(signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves raw bodies instead of JSON-encoding them again', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetch)
    await post('/test', { body: 'raw text' })
    expect(fetch.mock.calls[0][1].body).toBe('raw text')
  })

  it('encodes query parameter names and values', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetch)
    await get('/test?existing=1', { params: { 'a&b': 'hello world' } })
    expect(fetch.mock.calls[0][0]).toContain('?existing=1&a%26b=hello+world')
  })
})
