import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import LoginView from '../LoginView.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/auth/login', component: LoginView },
      { path: '/space/apps', name: 'space-apps-list', component: { template: '<div />' } },
    ],
  })
  await router.push('/auth/login')
  wrapper = mount(LoginView, { global: { plugins: [router, createPinia()] } })
  return { wrapper, router }
}

async function submit(wrapper: VueWrapper) {
  await wrapper.get('input[type="email"]').setValue('user@example.com')
  await wrapper.get('input[type="password"]').setValue('password123')
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
})
