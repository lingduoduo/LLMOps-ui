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
          component: {
            props: ['createType'],
            emits: ['update-create-type'],
            template: `<p>${section} list, create: {{ createType || 'none' }}</p>
              <button type="button" @click="$emit('update-create-type', '')">handled</button>`,
          },
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
    const links = view.findAll('a')
    expect(links.map((link) => link.attributes('href'))).toEqual([
      '/space/apps',
      '/space/tools',
      '/space/workflows',
      '/space/datasets',
    ])
    expect(links.map((link) => link.text())).toEqual([
      'AI Apps',
      'Tools',
      'Workflows',
      'Knowledge Bases',
    ])
    expect(view.text()).toContain('Personal Space')
    expect(view.text()).toContain('workflows list')
    expect(view.text()).toContain('Create Workflow')
  })

  it('puts the search term in the query and keeps the box in sync with it', async () => {
    const { router, view } = await render('/space/apps?search_word=old')
    const input = view.get<HTMLInputElement>('input[placeholder="Enter a keyword to search"]')
    expect(input.element.value).toBe('old')
    view.findComponent({ name: 'InputSearch' }).vm.$emit('search', 'weather')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/space/apps?search_word=weather')
    expect(input.element.value).toBe('weather')
  })

  it('passes createType to the tools page and lets the page reset it', async () => {
    const { view } = await render('/space/tools')
    expect(view.text()).toContain('tools list, create: none')
    await view
      .findAll('button')
      .find((el) => el.text() === 'Create Custom Tool')!
      .trigger('click')
    expect(view.text()).toContain('tools list, create: tool')
    await view
      .findAll('button')
      .find((el) => el.text() === 'handled')!
      .trigger('click')
    expect(view.text()).toContain('tools list, create: none')
  })

  it('shows the create button for each section', async () => {
    const { router, view } = await render('/space/apps')
    expect(view.text()).toContain('Create AI App')
    await router.push('/space/datasets')
    await flushPromises()
    expect(view.text()).toContain('Create Knowledge Base')
  })
})
