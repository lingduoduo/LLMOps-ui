import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ListView from '../ListView.vue'
import {
  getBuiltinApps,
  getBuiltinAppCategories,
  addBuiltinAppToSpace,
} from '@/services/builtin-app'
vi.mock('@/services/builtin-app', () => ({
  getBuiltinApps: vi.fn(),
  getBuiltinAppCategories: vi.fn(),
  addBuiltinAppToSpace: vi.fn(),
}))
let wrapper: VueWrapper
const app = (id: string, category: string) => ({
  id,
  category,
  name: id,
  description: `${id} helper`,
  icon: '',
  model_config: { provider: 'openai', model: 'gpt' },
  created_at: 1,
})
async function render() {
  vi.mocked(getBuiltinAppCategories).mockResolvedValue([
    { category: 'writing', name: 'Writing' },
    { category: 'other', name: 'Other' },
  ])
  vi.mocked(getBuiltinApps).mockResolvedValue([app('Alpha', 'writing'), app('Beta', 'other')])
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/store/apps', component: ListView },
      {
        path: '/space/apps/:app_id',
        name: 'space-apps-detail',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/store/apps')
  wrapper = mount(ListView, { global: { plugins: [router] } })
  await flushPromises()
  return router
}
afterEach(() => {
  wrapper?.unmount()
  vi.resetAllMocks()
})
it('shows the actual catalog and combines category with case-insensitive search', async () => {
  await render()
  expect(wrapper.findAll('[data-app]')).toHaveLength(2)
  await wrapper.get('#app-search').setValue('  ALPHA ')
  expect(wrapper.findAll('[data-app]')).toHaveLength(1)
  await wrapper.get('button[data-category="other"]').trigger('click')
  expect(wrapper.text()).toContain('No apps match')
})
it('adds a catalog app and opens the returned personal app editor', async () => {
  vi.mocked(addBuiltinAppToSpace).mockResolvedValue({ id: 'cloned-id' })
  const router = await render()
  await wrapper.get('button[aria-label="Add Alpha to Personal Space"]').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/space/apps/cloned-id')
})
it('shows an add error without navigating away', async () => {
  vi.mocked(addBuiltinAppToSpace).mockRejectedValue(new Error('Clone unavailable'))
  const router = await render()
  await wrapper.get('button[aria-label="Add Alpha to Personal Space"]').trigger('click')
  await flushPromises()
  expect(wrapper.get('[role="alert"]').text()).toContain('Clone unavailable')
  expect(router.currentRoute.value.path).toBe('/store/apps')
})
it('offers retry after a catalog failure', async () => {
  vi.mocked(getBuiltinApps).mockRejectedValueOnce(new Error('Catalog unavailable'))
  await render()
  expect(wrapper.get('[role="alert"]').text()).toContain('Catalog unavailable')
  await wrapper.get('button[aria-label="Retry loading apps"]').trigger('click')
  await flushPromises()
  expect(wrapper.findAll('[data-app]')).toHaveLength(2)
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
})
it('prevents duplicate adds and ignores a result after leaving the marketplace', async () => {
  let resolve!: (value: { id: string }) => void
  vi.mocked(addBuiltinAppToSpace).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  const router = await render()
  const navigate = vi.spyOn(router, 'push')
  const button = wrapper.get('button[aria-label="Add Alpha to Personal Space"]')
  await button.trigger('click')
  await button.trigger('click')
  expect(addBuiltinAppToSpace).toHaveBeenCalledTimes(1)
  wrapper.unmount()
  resolve({ id: 'late-id' })
  await flushPromises()
  expect(navigate).not.toHaveBeenCalled()
})
