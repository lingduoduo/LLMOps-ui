import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ArcoVue from '@arco-design/web-vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import ListView from '../ListView.vue'
import { getBuiltinTools, getCategories } from '@/services/builtin-tool'

vi.mock('@/services/builtin-tool', () => ({ getBuiltinTools: vi.fn(), getCategories: vi.fn() }))
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})
const provider = (name: string, category: string) => ({
  name,
  label: name,
  category,
  background: '#fff',
  description: `${name} description`,
  created_at: 1700000000,
  tools: [
    {
      name: 'lookup',
      label: 'Lookup',
      description: 'Find information',
      inputs: [{ name: 'query', type: 'str', description: 'Search query', required: true }],
    },
  ],
})
async function render() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })),
  )
  vi.mocked(getCategories).mockResolvedValue({
    code: 'success',
    message: '',
    data: [
      { category: 'search', name: 'Search', icon: '' },
      { category: 'other', name: 'Other', icon: '' },
    ],
  })
  vi.mocked(getBuiltinTools).mockResolvedValue({
    code: 'success',
    message: '',
    data: [provider('Alpha', 'search'), provider('Beta', 'other')],
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', name: 'space-tools-list', component: ListView }],
  })
  wrapper = mount(ListView, {
    global: { plugins: [ArcoVue, router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}
const cardTitles = (view: VueWrapper) =>
  view.findAll('.arco-col .arco-card .font-bold').map((title) => title.text())

describe('tool marketplace', () => {
  it('filters providers by category and case-insensitive search', async () => {
    const view = await render()
    expect(cardTitles(view)).toEqual(['Alpha', 'Beta'])
    expect(view.text()).toMatch(/LLMOps · Published\s*\d{2}-\d{2} \d{2}:\d{2}/)
    await view
      .findAll('button')
      .find((button) => button.text() === 'Other')!
      .trigger('click')
    expect(cardTitles(view)).toEqual(['Beta'])
    await view
      .findAll('button')
      .find((button) => button.text() === 'All')!
      .trigger('click')
    await view.get('input[placeholder="Enter a tool name"]').setValue('  ALPHA ')
    expect(cardTitles(view)).toEqual(['Alpha'])
    await view.get('input[placeholder="Enter a tool name"]').setValue('missing')
    expect(view.text()).toContain('No built-in tools available')
  })

  it('opens the provider drawer with its tools and parameters', async () => {
    const view = await render()
    await view.findAll('.arco-col .arco-card')[1]!.trigger('click')
    await flushPromises()
    const drawer = document.body.querySelector('.arco-drawer')!.textContent
    expect(drawer).toContain('Tool Details')
    expect(drawer).toContain('Beta description')
    expect(drawer).toContain('Includes 1 tool')
    expect(drawer).toContain('Search query')
    expect(drawer).toContain('String')
    expect(drawer).toContain('Required')
  })

  it('opens a provider from the keyboard', async () => {
    const view = await render()
    const card = view.get('[aria-label="View Alpha tools"]')
    expect(card.attributes('tabindex')).toBe('0')
    await card.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(document.body.querySelector('.arco-drawer')!.textContent).toContain('Alpha description')
  })

  it('shows load failures and retries without duplicating providers', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })),
    )
    vi.mocked(getCategories).mockResolvedValue({ code: 'success', message: '', data: [] })
    vi.mocked(getBuiltinTools)
      .mockRejectedValueOnce(new Error('Tools unavailable'))
      .mockResolvedValue({ code: 'success', message: '', data: [provider('Alpha', 'search')] })
    wrapper = mount(ListView, {
      global: { plugins: [ArcoVue, createRouter({ history: createMemoryHistory(), routes: [] })] },
    })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Tools unavailable')
    expect(wrapper.text()).not.toContain('No built-in tools available')
    await wrapper.get('button[aria-label="Retry loading tools"]').trigger('click')
    await flushPromises()
    expect(cardTitles(wrapper)).toEqual(['Alpha'])
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('cancels the request in flight when leaving the page', async () => {
    const signals: AbortSignal[] = []
    vi.mocked(getCategories).mockImplementation((signal) => {
      signals.push(signal!)
      return new Promise(() => {})
    })
    vi.mocked(getBuiltinTools).mockImplementation(() => new Promise(() => {}))
    wrapper = mount(ListView, {
      global: { plugins: [ArcoVue, createRouter({ history: createMemoryHistory(), routes: [] })] },
    })
    expect(signals[0]!.aborted).toBe(false)
    wrapper.unmount()
    wrapper = undefined
    expect(signals[0]!.aborted).toBe(true)
  })
})
