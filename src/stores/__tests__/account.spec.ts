import { afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAccountStore } from '../account'
import { clearCredential, setCredential } from '@/utils/auth'

afterEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

it('does not restore account state when a pending profile request finishes after sign-out', async () => {
  setActivePinia(createPinia())
  setCredential({ access_token: 'test-token', expire_at: Math.floor(Date.now() / 1000) + 3600 })
  let finish!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    ),
  )
  const store = useAccountStore()
  const pending = store.load()
  clearCredential()
  finish(
    new Response(
      JSON.stringify({
        code: 'success',
        message: '',
        data: { id: 'old-user', name: 'Old user', email: 'old@example.com', avatar: '' },
      }),
    ),
  )
  await pending
  expect(store.account).toBeNull()
})
