import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ArcoVue from '@arco-design/web-vue'
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
  tools: [{ name: 'lookup', label: 'Lookup', description: 'Find information', inputs: [] }],
})
function render() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })),
  )
  wrapper = mount(ListView, {
    global: { plugins: [ArcoVue], stubs: { CustomToolsPanel: true } },
    attachTo: document.body,
  })
  return wrapper
}
describe('tool marketplace', () => {
  it('filters case-insensitively and keeps the selected provider stable when filters change', async () => {
    vi.mocked(getCategories).mockResolvedValue({ code: 'success', message: '', data: [] })
    vi.mocked(getBuiltinTools).mockResolvedValue({
      code: 'success',
      message: '',
      data: [provider('Alpha', 'search'), provider('Beta', 'other')],
    })
    const view = render()
    await flushPromises()
    await view.get('button[aria-label="View Alpha tools"]').trigger('click')
    await view.get('input[placeholder="Search tools by name"]').setValue('  BETA ')
    expect(view.findAll('[data-provider]')).toHaveLength(1)
    expect(view.get('[data-provider]').attributes('data-provider')).toBe('Beta')
    expect(document.body.textContent).toContain('Alpha description')
    expect(document.body.textContent).toContain('Lookup')
  })
  it('shows load failures and supports retry without duplicate providers', async () => {
    vi.mocked(getCategories).mockResolvedValue({ code: 'success', message: '', data: [] })
    vi.mocked(getBuiltinTools)
      .mockRejectedValueOnce(new Error('Tools unavailable'))
      .mockResolvedValue({ code: 'success', message: '', data: [provider('Alpha', 'search')] })
    const view = render()
    await flushPromises()
    expect(view.get('[role="alert"]').text()).toContain('Tools unavailable')
    await view.get('button[aria-label="Retry loading tools"]').trigger('click')
    await flushPromises()
    expect(view.findAll('[data-provider]')).toHaveLength(1)
    expect(view.find('[role="alert"]').exists()).toBe(false)
  })
})
