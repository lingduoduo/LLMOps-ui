import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import LoginView from '../LoginView.vue'
import { useAccountStore } from '@/stores/account'
import { DEV_ACCOUNT } from '@/services/auth'
import { isLogin } from '@/utils/auth'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

async function render(path = '/auth/login') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/auth/login', component: LoginView },
      { path: '/home', component: { template: '<div />' } },
      { path: '/space/apps', name: 'space-apps-list', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  const pinia = createPinia()
  setActivePinia(pinia)
  wrapper = mount(LoginView, { global: { plugins: [router, pinia] } })
  return { wrapper, router }
}

async function submit(wrapper: VueWrapper, email = 'user@example.com', password = 'password123') {
  await wrapper.get('#email').setValue(email)
  await wrapper.get('input[type="password"]').setValue(password)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('password login', () => {
  it('stores the backend credential, fetches the account, and opens applications', async () => {
    const fetch = vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith('/auth/password-login')) {
        expect(JSON.parse(options.body as string)).toEqual({
          email: 'user@example.com',
          password: 'password123',
        })
        return new Response(
          JSON.stringify({
            code: 'success',
            message: '',
            data: { access_token: 'test-token', expire_at: Math.floor(Date.now() / 1000) + 3600 },
          }),
        )
      }
      expect(url).toBe('/api/account')
      expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-token')
      return new Response(
        JSON.stringify({
          code: 'success',
          message: '',
          data: { id: 'account-id', name: 'Test', email: 'user@example.com', avatar: '' },
        }),
      )
    })
    vi.stubGlobal('fetch', fetch)
    const { wrapper, router } = await render()
    await submit(wrapper)
    expect(router.currentRoute.value.path).toBe('/space/apps')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('displays invalid credentials without creating a session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: 'fail', message: 'Invalid credentials', data: {} })),
      ),
    )
    const { wrapper, router } = await render()
    await submit(wrapper)
    expect(wrapper.get('[role="alert"]').text()).toContain('Invalid credentials')
    expect(router.currentRoute.value.path).toBe('/auth/login')
  })

  it('signs in as the dev admin without contacting the backend', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { wrapper, router } = await render('/auth/login?redirect=/home')
    expect(wrapper.text()).toContain('Dev mode')
    await submit(wrapper, 'admin', 'admin')
    expect(fetch).not.toHaveBeenCalled()
    expect(isLogin()).toBe(true)
    expect(useAccountStore().account).toEqual(DEV_ACCOUNT)
    expect(router.currentRoute.value.path).toBe('/home')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('sends a wrong dev admin password to the backend instead of signing in', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ code: 'fail', message: 'Invalid credentials', data: {} })),
    )
    vi.stubGlobal('fetch', fetch)
    const { wrapper, router } = await render()
    await submit(wrapper, 'admin', 'wrong')
    expect(fetch).toHaveBeenCalledOnce()
    expect(isLogin()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('Invalid credentials')
    expect(router.currentRoute.value.path).toBe('/auth/login')
  })
})
