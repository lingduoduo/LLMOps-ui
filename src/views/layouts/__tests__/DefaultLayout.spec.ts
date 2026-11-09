import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ArcoVue from '@arco-design/web-vue'
import ArcoVueIcon from '@arco-design/web-vue/es/icon'
import { createMemoryHistory, createRouter } from 'vue-router'
import DefaultLayout from '../DefaultLayout.vue'

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

async function render(path = '/store/tools') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/home', '/space/apps', '/space/tools', '/store/apps', '/store/tools', '/open'].map(
      (route) => ({ path: route, component: { template: '<p>Page content</p>' } }),
    ),
  })
  await router.push(path)
  wrapper = mount(DefaultLayout, {
    global: { plugins: [ArcoVue, ArcoVueIcon, router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}
const link = (view: VueWrapper, text: string) => view.findAll('a').find((el) => el.text() === text)!

describe('default sidebar layout', () => {
  it('renders the sidebar navigation, account block, and page outlet', async () => {
    const view = await render()
    expect(view.findAll('a').map((el) => el.attributes('href'))).toEqual([
      '/home',
      '/home',
      '/space/apps',
      '/store/apps',
      '/store/tools',
      '/open',
    ])
    expect(view.text()).toContain('Create AI App')
    expect(view.text()).toContain('Explore')
    expect(view.text()).toContain('Ling Huang')
    expect(view.text()).toContain('linghypshen@gmail.com')
    expect(view.text()).toContain('Page content')
  })

  it.each([
    ['/home', 'Home'],
    ['/space/apps', 'Personal Space'],
    ['/space/tools', 'Personal Space'],
    ['/store/apps', 'App Marketplace'],
    ['/store/tools', 'Tool Marketplace'],
    ['/open', 'Open API'],
  ])('highlights only the active section at %s', async (path, active) => {
    const view = await render(path)
    const sections = ['Home', 'Personal Space', 'App Marketplace', 'Tool Marketplace', 'Open API']
    const highlighted = sections.filter((name) =>
      link(view, name).classes().includes('bg-gray-100'),
    )
    expect(highlighted).toEqual([active])
  })

  it('shows the account menu options', async () => {
    const view = await render()
    await view.get('.arco-dropdown-open-trigger, .arco-avatar').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Account Settings')
    expect(document.body.textContent).toContain('Log Out')
  })
})
