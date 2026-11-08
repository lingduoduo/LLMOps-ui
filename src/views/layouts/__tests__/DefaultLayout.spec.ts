import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import DefaultLayout from '../DefaultLayout.vue'
import { useAccountStore } from '@/stores/account'
import { logout } from '@/services/auth'
import { clearCredential, isLogin, setCredential } from '@/utils/auth'

vi.mock('@/services/auth', async (original) => ({
  ...(await original<typeof import('@/services/auth')>()),
  logout: vi.fn(),
}))
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  sessionStorage.clear()
  vi.restoreAllMocks()
})
async function render(account = true, path = '/store/tools') {
  const pinia = createPinia()
  const store = useAccountStore(pinia)
  if (account)
    store.account = { id: '1', name: 'Ada Lovelace', email: 'ada@example.com', avatar: '/ada.png' }
  const load = vi.spyOn(store, 'load').mockRejectedValue(new Error('Account unavailable'))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...[
        { path: '/home', name: 'pages-home', section: 'home' },
        { path: '/space/apps', name: 'space-apps-list', section: 'space' },
        { path: '/space/apps/create', name: 'space-apps-create', section: 'space' },
        { path: '/store/apps', name: 'store-apps-list', section: 'apps' },
        { path: '/store/tools', name: 'store-tools-list', section: 'tools' },
        { path: '/open', name: 'open-api', section: 'open' },
      ].map(({ path, name, section }) => ({
        path,
        name,
        meta: { navigationSection: section as import('@/router/navigation').NavigationSection },
        component: { template: '<p>Page content</p>' },
      })),
      {
        path: '/account/settings',
        name: 'account-settings',
        component: { template: '<p>Settings</p>' },
      },
    ],
  })
  await router.push(path)
  wrapper = mount(DefaultLayout, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { view: wrapper, store, load, router }
}
describe('default sidebar layout', () => {
  it.each([
    ['/home', '/home'],
    ['/space/apps', '/space/apps'],
    ['/space/apps/create', '/space/apps'],
    ['/store/apps', '/store/apps'],
    ['/store/tools', '/store/tools'],
    ['/open', '/open'],
  ])('highlights only the correct sidebar section at %s', async (path, activeLink) => {
    const { view } = await render(true, path)
    const current = view.findAll('nav a[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0]?.attributes('href')).toBe(activeLink)
  })
  it('renders one page outlet, English navigation, and the signed-in account', async () => {
    const { view, load } = await render()
    expect(view.text()).toContain('Ada Lovelace')
    expect(view.text()).toContain('ada@example.com')
    expect(view.findAll('nav[aria-label="Main navigation"]')).toHaveLength(1)
    expect(view.get('a[href="/store/tools"]').attributes('aria-current')).toBe('page')
    expect(view.text().match(/Page content/g)).toHaveLength(1)
    expect(view.get('a[href="/open"]').text()).toBe('Open API')
    expect(view.get('a[href="/space/apps/create"]').text()).toContain('Create AI Application')
    expect(view.get('a[href="/account/settings"]').text()).toContain('Account settings')
    expect(load).not.toHaveBeenCalled()
  })
  it('clears local session and account even when logout fails', async () => {
    setCredential({ access_token: 'test', expire_at: Math.floor(Date.now() / 1000) + 1000 })
    vi.mocked(logout).mockRejectedValue(new Error('Offline'))
    const { view, store } = await render()
    await view.get('button[aria-label="Sign out"]').trigger('click')
    await flushPromises()
    expect(isLogin()).toBe(false)
    expect(store.account).toBeNull()
  })
  it('shows account loading errors and permits retry', async () => {
    const { view, load } = await render(false)
    expect(view.get('[role="alert"]').text()).toContain('Account unavailable')
    load.mockImplementation(async () => {})
    await view.get('button[aria-label="Retry loading account"]').trigger('click')
    await flushPromises()
    expect(view.find('[role="alert"]').exists()).toBe(false)
  })
  it('clears the displayed profile when the session ends', async () => {
    const { view } = await render()
    clearCredential()
    await flushPromises()
    expect(view.text()).not.toContain('Ada Lovelace')
  })
})
