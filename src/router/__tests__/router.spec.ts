import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { clearCredential, isLogin, setCredential } from '@/utils/auth'
import router from '../index'
import { navigationGroups } from '../navigation'

const accountResponse = () =>
  new Response(
    JSON.stringify({
      code: 'success',
      message: '',
      data: { id: 'account-id', name: 'Test', email: 'user@example.com', avatar: '' },
    }),
  )
let fetch: ReturnType<typeof vi.fn<typeof globalThis.fetch>>

beforeEach(async () => {
  setActivePinia(createPinia())
  fetch = vi.fn<typeof globalThis.fetch>(async () => accountResponse())
  vi.stubGlobal('fetch', fetch)
  // Start each test from a public (not-found) page so earlier tests don't leak their location.
  await router.push('/test-start')
})
afterEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

const signIn = () =>
  setCredential({ access_token: 'test-token', expire_at: Math.floor(Date.now() / 1000) + 3600 })

describe('protected navigation', () => {
  it.each([
    ['/space/apps/create', 'space-apps-create'],
    ['/space/tools', 'space-tools-list'],
    ['/space/workflows', 'space-workflows-list'],
    ['/space/datasets', 'space-datasets-list'],
    ['/account/settings', 'account-settings'],
    ['/open', 'open-api'],
  ])('protects and resolves %s', async (path, name) => {
    await router.push(path)
    expect(router.currentRoute.value.name).toBe('auth-login')
    expect(router.currentRoute.value.query.redirect).toBe(path)
    signIn()
    await router.push(path)
    expect(router.currentRoute.value.name).toBe(name)
  })
  it('protects the tool marketplace and resolves it after sign-in', async () => {
    await router.push('/store/tools')
    expect(router.currentRoute.value.name).toBe('auth-login')
    expect(router.currentRoute.value.query.redirect).toBe('/store/tools')
    signIn()
    await router.push('/store/tools')
    expect(router.currentRoute.value.name).toBe('store-tools-list')
    await router.push('/store/apps')
    expect(router.currentRoute.value.name).toBe('store-apps-list')
  })
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

  it('opens the apps tab for the personal space root', async () => {
    signIn()
    await router.push('/space')
    expect(router.currentRoute.value.name).toBe('space-apps-list')
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

describe('server session check', () => {
  it('confirms the session with the backend once, then uses the loaded account', async () => {
    signIn()
    await router.push('/space/apps')
    await router.push('/home')
    expect(router.currentRoute.value.name).toBe('pages-home')
    expect(fetch).toHaveBeenCalledOnce()
    expect(String(fetch.mock.calls[0]?.[0])).toBe('/api/account')
  })

  it('sends users with a token the backend rejects to login, keeping their destination', async () => {
    fetch.mockResolvedValue(
      new Response(JSON.stringify({ code: 'unauthorized', message: 'Expired', data: {} }), {
        status: 401,
      }),
    )
    signIn()
    await router.push('/space/apps/example')
    expect(isLogin()).toBe(false)
    expect(router.currentRoute.value.name).toBe('auth-login')
    expect(router.currentRoute.value.query.redirect).toBe('/space/apps/example')
  })

  it('keeps the session when the backend is unavailable', async () => {
    fetch.mockResolvedValue(new Response('Bad gateway', { status: 502 }))
    signIn()
    await router.push('/space/apps')
    expect(isLogin()).toBe(true)
    expect(router.currentRoute.value.name).toBe('space-apps-list')
  })
})

describe('unknown URLs', () => {
  it('show the not-found page without requiring login', async () => {
    await router.push('/does/not/exist')
    expect(router.currentRoute.value.name).toBe('not-found')
    expect(router.currentRoute.value.path).toBe('/does/not/exist')
  })
})

describe('sidebar destinations', () => {
  it('maps each sidebar link to its own page and active section', () => {
    const destinations = navigationGroups.flatMap((group) => [...group.items])
    const paths = destinations.map((item) => {
      const resolved = router.resolve({ name: item.routeName })
      expect(resolved.meta.navigationSection).toBe(item.section)
      expect(resolved.matched.at(-1)?.components?.default).toBeDefined()
      return resolved.path
    })
    expect(new Set(paths).size).toBe(destinations.length)
    expect(router.resolve('/space/apps/create').meta.navigationSection).toBe('space')
    expect(router.resolve('/space/apps/example').meta.navigationSection).toBe('space')
    for (const tab of ['tools', 'workflows', 'datasets'])
      expect(router.resolve(`/space/${tab}`).meta.navigationSection).toBe('space')
  })
})
