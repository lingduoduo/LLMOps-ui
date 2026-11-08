import { afterEach, describe, expect, it, vi } from 'vitest'
import { getApiToolProvider, updateApiToolProvider } from '../api-tool'
import { getBuiltinTools } from '../builtin-tool'

afterEach(() => vi.unstubAllGlobals())

describe('tool API contracts', () => {
  it('encodes provider IDs and returns the response envelope', async () => {
    const data = { id: 'example/one', name: 'Example', headers: [], openapi_schema: '{}' }
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response(JSON.stringify({ code: 'success', data })),
    )
    vi.stubGlobal('fetch', fetch)
    await expect(getApiToolProvider('example/one')).resolves.toMatchObject({ data })
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/api-tools/example%2Fone')
    await updateApiToolProvider('example/one', {
      name: 'Example',
      icon: '',
      headers: [],
      openapi_schema: '{}',
    })
    expect(fetch.mock.calls[1]?.[0]).toBe('/api/api-tools/example%2Fone')
  })

  it('rejects malformed provider lists before they reach the view', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ code: 'success', data: {} }))),
    )
    await expect(getBuiltinTools()).rejects.toThrow(/invalid/i)
  })
})
