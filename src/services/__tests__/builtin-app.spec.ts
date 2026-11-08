import { afterEach, expect, it, vi } from 'vitest'
import { getBuiltinApps, getBuiltinAppCategories, addBuiltinAppToSpace } from '../builtin-app'
afterEach(() => vi.unstubAllGlobals())
it('uses the catalog endpoints and the verified clone body', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async (url) =>
      new Response(
        JSON.stringify({
          code: 'success',
          data: String(url).includes('add-builtin') ? { id: 'new-id' } : [],
        }),
      ),
  )
  vi.stubGlobal('fetch', fetch)
  await getBuiltinAppCategories()
  await getBuiltinApps()
  await expect(addBuiltinAppToSpace('builtin-id')).resolves.toEqual({ id: 'new-id' })
  expect(fetch.mock.calls.map((c) => c[0])).toEqual([
    '/api/builtin-apps/categories',
    '/api/builtin-apps',
    '/api/builtin-apps/add-builtin-app-to-space',
  ])
  expect(JSON.parse(fetch.mock.calls[2]?.[1]?.body as string)).toEqual({
    builtin_app_id: 'builtin-id',
  })
})
it('rejects malformed catalogs and clone results', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ code: 'success', data: {} }))),
  )
  await expect(getBuiltinApps()).rejects.toThrow(/invalid/i)
  await expect(addBuiltinAppToSpace('id')).rejects.toThrow(/invalid/i)
})
