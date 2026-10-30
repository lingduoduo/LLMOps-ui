import { afterEach, describe, expect, it } from 'vitest'
import { setCredential } from '@/utils/auth'
import router from '../index'

afterEach(() => sessionStorage.clear())

describe('protected navigation', () => {
  it('allows protected navigation with an unexpired backend credential', async () => {
    setCredential({ access_token: 'test-token', expire_at: Math.floor(Date.now() / 1000) + 3600 })
    await router.push('/space/apps')
    expect(router.currentRoute.value.path).toBe('/space/apps')
  })

  it('rejects expired persisted credentials', async () => {
    sessionStorage.setItem(
      'llmops.credential',
      JSON.stringify({ access_token: 'expired', expire_at: 1 }),
    )
    await router.push('/home')
    expect(router.currentRoute.value.path).toBe('/auth/login')
  })

  it('redirects unauthenticated users to login and remembers the destination', async () => {
    await router.push('/space/apps/example')
    expect(router.currentRoute.value.path).toBe('/auth/login')
    expect(router.currentRoute.value.query.redirect).toBe('/space/apps/example')
  })
})
