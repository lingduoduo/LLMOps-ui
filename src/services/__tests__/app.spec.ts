import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, debugApp } from '../app'

afterEach(() => vi.unstubAllGlobals())

describe('backend debug request', () => {
  it('posts the query to the JSON debug endpoint and returns its response', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(
          JSON.stringify({ code: 'success', message: '', data: { content: 'Hello world' } }),
        ),
    )
    vi.stubGlobal('fetch', fetch)
    await expect(debugApp('example/app', 'Hello')).resolves.toMatchObject({
      data: { content: 'Hello world' },
    })
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/apps/example%2Fapp/debug')
    expect(fetch.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toEqual({ query: 'Hello' })
  })
  it('reports backend failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ code: 'fail', message: 'Model offline' }))),
    )
    await expect(debugApp('example', 'Hello')).rejects.toThrow('Model offline')
  })
})

describe('application creation contract', () => {
  it('posts creation fields and returns the new application ID', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response(JSON.stringify({ code: 'success', data: { id: 'new-app' } })),
    )
    vi.stubGlobal('fetch', fetch)
    const body = { name: 'Research', icon: 'https://example.com/icon.png', description: '' }
    await expect(createApp(body)).resolves.toEqual({ id: 'new-app' })
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/apps')
    expect(fetch.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toEqual(body)
  })
  it('rejects successful responses with no created application ID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ code: 'success', data: {} }))),
    )
    await expect(
      createApp({ name: 'Research', icon: 'https://example.com/icon.png', description: '' }),
    ).rejects.toThrow(/invalid application ID/)
  })
})
