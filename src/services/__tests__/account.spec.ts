import { afterEach, expect, it, vi } from 'vitest'
import { updateAccountName, updateAccountAvatar, updateAccountPassword } from '../account'
afterEach(() => vi.unstubAllGlobals())
it('posts separate account mutations and accepts empty success data', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => new Response(JSON.stringify({ code: 'success', data: {} })),
  )
  vi.stubGlobal('fetch', fetch)
  await updateAccountName('New name')
  await updateAccountAvatar('https://example.com/avatar.png')
  await updateAccountPassword('password123')
  expect(fetch.mock.calls.map((call) => call[0])).toEqual([
    '/api/account/name',
    '/api/account/avatar',
    '/api/account/password',
  ])
  expect(fetch.mock.calls.map((call) => JSON.parse(call[1]?.body as string))).toEqual([
    { name: 'New name' },
    { avatar: 'https://example.com/avatar.png' },
    { password: 'password123' },
  ])
  expect(fetch.mock.calls.every((call) => call[1]?.method === 'POST')).toBe(true)
})
it('surfaces rejected mutations', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof globalThis.fetch>(
      async () => new Response(JSON.stringify({ code: 'fail', message: 'Rejected' })),
    ),
  )
  await expect(updateAccountName('New name')).rejects.toThrow('Rejected')
})
