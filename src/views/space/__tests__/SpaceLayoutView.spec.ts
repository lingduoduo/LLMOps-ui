import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ArcoVue from '@arco-design/web-vue'
import SpaceLayoutView from '../SpaceLayoutView.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
})

async function render(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/space',
        component: SpaceLayoutView,
        children: ['apps', 'tools', 'workflows', 'datasets'].map((section) => ({
          path: section,
          name: `space-${section}-list`,
          component: { template: `<p>${section} list</p>` },
        })),
      },
      { path: '/space/apps/create', name: 'space-apps-create', component: { template: '<p />' } },
    ],
  })
  await router.push(path)
  wrapper = mount({ template: '<router-view />' }, { global: { plugins: [ArcoVue, router] } })
  await flushPromises()
  return { router, view: wrapper }
}

describe('personal space layout', () => {
  it('links every section and shows the active section', async () => {
    const { view } = await render('/space/workflows')
    const tabs = view.get('nav[aria-label="Personal space sections"]').findAll('a')
    expect(tabs.map((tab) => tab.attributes('href'))).toEqual([
      '/space/apps',
      '/space/tools',
      '/space/workflows',
      '/space/datasets',
    ])
    expect(view.text()).toContain('workflows list')
  })

  it('stores the trimmed search term in the query and keeps it in the box', async () => {
    const { router, view } = await render('/space/apps?search_word=old')
    const input = view.get<HTMLInputElement>('input[placeholder="Search by keyword"]')
    expect(input.element.value).toBe('old')
    await input.setValue('  weather ')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/space/apps?search_word=weather')
    await input.setValue('')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/space/apps')
  })

  it('shows the create action for the active section', async () => {
    const { router, view } = await render('/space/tools?search_word=x')
    const create = view.findAll('button').find((el) => el.text() === 'Create Custom Tool')!
    await create.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ search_word: 'x', create: 'tool' })

    await router.push('/space/apps')
    await flushPromises()
    await view
      .findAll('button')
      .find((el) => el.text() === 'Create AI App')!
      .trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('space-apps-create')
  })
})
