import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { clearCredential, setCredential } from '@/utils/auth'
import router from '../index'

afterEach(() => sessionStorage.clear())

const signIn = () =>
  setCredential({ access_token: 'test-token', expire_at: Math.floor(Date.now() / 1000) + 3600 })

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

  it('redirects the root URL to home', async () => {
    signIn()
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('pages-home')
  })

  it('serves the about page', async () => {
    signIn()
    await router.push('/about')
    expect(router.currentRoute.value.name).toBe('pages-about')
  })

  it('sends signed-in users away from the login page', async () => {
    signIn()
    await router.push('/auth/login')
    expect(router.currentRoute.value.name).toBe('space-apps-list')
  })

  it('returns signed-in users to login when their session is cleared', async () => {
    signIn()
    await router.push('/space/apps/example')
    clearCredential()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('auth-login')
    expect(router.currentRoute.value.query.redirect).toBe('/space/apps/example')
  })
})

describe('unknown URLs', () => {
  it('show the not-found page without requiring login', async () => {
    await router.push('/does/not/exist')
    expect(router.currentRoute.value.name).toBe('not-found')
    expect(router.currentRoute.value.path).toBe('/does/not/exist')
  })
})
