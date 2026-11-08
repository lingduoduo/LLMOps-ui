import { afterEach, expect, it, vi } from 'vitest'
import { getApiKeys, createApiKey, updateApiKey, toggleApiKey, deleteApiKey } from '../api-key'
afterEach(() => vi.unstubAllGlobals())
it('uses paginated reads and encoded POST mutations without returning a fabricated key', async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        code: 'success',
        data: {
          list: [],
          paginator: { current_page: 2, total_page: 2, total_record: 21, page_size: 20 },
        },
      }),
    ),
  )
  vi.stubGlobal('fetch', fetch)
  await getApiKeys(2)
  expect(fetch.mock.calls[0]?.[0]).toBe('/api/openapi/api-keys?current_page=2&page_size=20')
  fetch.mockImplementation(
    async () => new Response(JSON.stringify({ code: 'success', message: 'Saved', data: null })),
  )
  await createApiKey({ remark: 'Production', is_active: true })
  await updateApiKey('a/b', { remark: 'New', is_active: false })
  await toggleApiKey('a/b', true)
  await deleteApiKey('a/b')
  expect(fetch.mock.calls.slice(1).map((call) => call[0])).toEqual([
    '/api/openapi/api-keys',
    '/api/openapi/api-keys/a%2Fb',
    '/api/openapi/api-keys/a%2Fb/is-active',
    '/api/openapi/api-keys/a%2Fb/delete',
  ])
  expect(JSON.parse(fetch.mock.calls[3]?.[1].body)).toEqual({ is_active: true })
})
it.each(['create', 'edit', 'toggle', 'delete'])('propagates %s failures', async (operation) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ code: 'fail', message: 'Denied' }))),
  )
  const actions = {
    create: () => createApiKey({ remark: '', is_active: true }),
    edit: () => updateApiKey('id', { remark: '', is_active: false }),
    toggle: () => toggleApiKey('id', false),
    delete: () => deleteApiKey('id'),
  }
  await expect(actions[operation as keyof typeof actions]()).rejects.toThrow('Denied')
})
