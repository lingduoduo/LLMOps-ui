import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import CreateView from '../CreateView.vue'
import { createApp } from '@/services/app'
vi.mock('@/services/app', () => ({ createApp: vi.fn() }))
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  vi.resetAllMocks()
})
async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/space/apps/create', component: CreateView },
      {
        path: '/space/apps/:app_id',
        name: 'space-apps-detail',
        component: { template: '<p>Editor</p>' },
      },
      { path: '/space/apps', name: 'space-apps-list', component: { template: '<p>Apps</p>' } },
    ],
  })
  await router.push('/space/apps/create')
  wrapper = mount(CreateView, { global: { plugins: [router] } })
  return { view: wrapper, router }
}
describe('application creation', () => {
  it('creates an application and opens its editor using the returned ID', async () => {
    vi.mocked(createApp).mockResolvedValue({ id: 'created/app' })
    const { view, router } = await render()
    await view.get('#app-name').setValue('  Research Assistant  ')
    await view.get('#app-icon').setValue('https://example.com/icon.png')
    await view.get('#app-description').setValue('Answers research questions')
    await view.get('form').trigger('submit')
    await flushPromises()
    expect(createApp).toHaveBeenCalledWith(
      {
        name: 'Research Assistant',
        icon: 'https://example.com/icon.png',
        description: 'Answers research questions',
      },
      expect.any(AbortSignal),
    )
    expect(router.currentRoute.value.params.app_id).toBe('created/app')
    expect(router.currentRoute.value.path).toBe('/space/apps/created%2Fapp')
  })
  it('keeps entered fields when creation fails and rejects whitespace-only names', async () => {
    const { view } = await render()
    await view.get('#app-name').setValue('   ')
    await view.get('form').trigger('submit')
    expect(createApp).not.toHaveBeenCalled()
    vi.mocked(createApp).mockRejectedValue(new Error('Unable to create application'))
    await view.get('#app-name').setValue('Research')
    await view.get('#app-icon').setValue('https://example.com/icon.png')
    await view.get('form').trigger('submit')
    await flushPromises()
    expect(view.get('[role="alert"]').text()).toContain('Unable to create application')
    expect(view.get<HTMLInputElement>('#app-name').element.value).toBe('Research')
  })
})
