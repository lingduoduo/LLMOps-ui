import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia } from 'pinia'
import ListView from '../ListView.vue'

afterEach(() => vi.unstubAllGlobals())

describe('application entry', () => {
  it('opens the entered backend application ID without allowing path injection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'success',
              message: '',
              data: {
                list: [
                  {
                    id: 'example-app',
                    name: 'Example app',
                    description: 'Test description',
                    status: 'draft',
                  },
                ],
                paginator: { current_page: 1, page_size: 20, total_page: 1, total_record: 1 },
              },
            }),
          ),
      ),
    )
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/space/apps', component: ListView },
        {
          path: '/space/apps/:app_id',
          name: 'space-apps-detail',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push('/space/apps')
    const wrapper = mount(ListView, { global: { plugins: [router, createPinia()] } })
    await flushPromises()
    expect(wrapper.text()).toContain('Example app')
    expect(wrapper.get('a[href="/space/apps/example-app"]').text()).toContain('Example app')
    await wrapper.get('#app-id').setValue('  example/one  ')
    await wrapper.get('form:last-of-type').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.params.app_id).toBe('example/one')
    expect(router.currentRoute.value.path).toBe('/space/apps/example%2Fone')
    wrapper.unmount()
  })

  it('searches with the term from the shared personal space query', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(
          JSON.stringify({
            code: 'success',
            message: '',
            data: {
              list: [],
              paginator: { current_page: 1, page_size: 20, total_page: 0, total_record: 0 },
            },
          }),
        ),
    )
    vi.stubGlobal('fetch', fetch)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/space/apps', component: ListView }],
    })
    await router.push('/space/apps?search_word=%20mock%20')
    const wrapper = mount(ListView, { global: { plugins: [router, createPinia()] } })
    await flushPromises()
    expect(String(fetch.mock.calls.at(-1)?.[0])).toContain('search_word=mock')
    await router.push('/space/apps?search_word=other')
    await flushPromises()
    expect(String(fetch.mock.calls.at(-1)?.[0])).toContain('search_word=other')
    expect(wrapper.text()).toContain('No applications found.')
    wrapper.unmount()
  })
})
