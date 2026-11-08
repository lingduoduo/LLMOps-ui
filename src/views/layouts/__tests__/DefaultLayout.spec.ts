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
async function render(account = true) {
  const pinia = createPinia()
  const store = useAccountStore(pinia)
  if (account)
    store.account = { id: '1', name: 'Ada Lovelace', email: 'ada@example.com', avatar: '/ada.png' }
  const load = vi.spyOn(store, 'load').mockRejectedValue(new Error('Account unavailable'))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<p>Page content</p>' } }],
  })
  await router.push('/store/tools')
  wrapper = mount(DefaultLayout, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { view: wrapper, store, load, router }
}
describe('default sidebar layout', () => {
  it('renders one page outlet, English navigation, and the signed-in account', async () => {
    const { view, load } = await render()
    expect(view.text()).toContain('Ada Lovelace')
    expect(view.text()).toContain('ada@example.com')
    expect(view.findAll('nav[aria-label="Main navigation"]')).toHaveLength(1)
    expect(view.get('a[href="/store/tools"]').attributes('aria-current')).toBe('page')
    expect(view.text().match(/Page content/g)).toHaveLength(1)
    expect(view.find('a[href="/open"]').exists()).toBe(false)
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
