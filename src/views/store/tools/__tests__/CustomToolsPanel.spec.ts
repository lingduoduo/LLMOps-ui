import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import CustomToolsPanel from '../CustomToolsPanel.vue'
import {
  createApiToolProvider,
  getApiToolProvider,
  updateApiToolProvider,
  deleteApiToolProvider,
  getApiToolProvidersWithPage,
  validateOpenAPISchema,
} from '@/services/api-tool'
vi.mock('@/services/api-tool', () => ({
  createApiToolProvider: vi.fn(),
  getApiToolProvidersWithPage: vi.fn(),
  validateOpenAPISchema: vi.fn(),
  getApiToolProvider: vi.fn(),
  updateApiToolProvider: vi.fn(),
  deleteApiToolProvider: vi.fn(),
}))
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  vi.resetAllMocks()
})
const emptyPage = {
  code: 'success',
  message: '',
  data: { list: [], paginator: { total_page: 0, total_record: 0, current_page: 1, page_size: 20 } },
}
describe('custom tools', () => {
  it('loads provider details for editing and confirms deletion before removing it', async () => {
    const provider = {
      id: 'weather',
      name: 'Weather',
      icon: '',
      description: 'Forecast',
      headers: [],
      tools: [],
      created_at: 1700000000,
    }
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue({
      ...emptyPage,
      data: { ...emptyPage.data, list: [provider] },
    })
    vi.mocked(getApiToolProvider).mockResolvedValue({
      code: 'success',
      message: '',
      data: { ...provider, openapi_schema: '{}' },
    })
    vi.mocked(validateOpenAPISchema).mockResolvedValue({ code: 'success', message: '', data: null })
    vi.mocked(updateApiToolProvider).mockResolvedValue({ code: 'success', message: '', data: null })
    vi.mocked(deleteApiToolProvider).mockResolvedValue({ code: 'success', message: '', data: null })
    wrapper = mount(CustomToolsPanel)
    await flushPromises()
    const edit = wrapper.findAll('button').find((button) => button.text() === 'Edit Weather')!
    await edit.trigger('click')
    await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Tool name"]').element.value).toBe(
      'Weather',
    )
    await wrapper.get('input[aria-label="Tool name"]').setValue('Updated Weather')
    await wrapper.get('form[aria-label="Custom tool editor"]').trigger('submit')
    await flushPromises()
    expect(updateApiToolProvider).toHaveBeenCalledWith('weather', {
      name: 'Updated Weather',
      icon: '',
      openapi_schema: '{}',
      headers: [],
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Delete')!
      .trigger('click')
    expect(deleteApiToolProvider).not.toHaveBeenCalled()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Confirm delete')!
      .trigger('click')
    await flushPromises()
    expect(deleteApiToolProvider).toHaveBeenCalledWith('weather')
  })
  it('validates the schema before creating and refreshes the provider list', async () => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(emptyPage)
    vi.mocked(validateOpenAPISchema).mockResolvedValue({ code: 'success', message: '', data: null })
    vi.mocked(createApiToolProvider).mockResolvedValue({ code: 'success', message: '', data: null })
    wrapper = mount(CustomToolsPanel)
    await flushPromises()
    await wrapper.get('button[aria-label="Add custom tool"]').trigger('click')
    await wrapper.get('input[aria-label="Tool name"]').setValue('Weather')
    await wrapper.get('textarea[aria-label="OpenAPI schema"]').setValue('{"openapi":"3.0.0"}')
    await wrapper.get('form[aria-label="Custom tool editor"]').trigger('submit')
    await flushPromises()
    expect(validateOpenAPISchema).toHaveBeenCalledWith('{"openapi":"3.0.0"}')
    expect(createApiToolProvider).toHaveBeenCalledWith({
      name: 'Weather',
      icon: '',
      openapi_schema: '{"openapi":"3.0.0"}',
      headers: [],
    })
    expect(getApiToolProvidersWithPage).toHaveBeenCalledTimes(2)
    expect(wrapper.find('form[aria-label="Custom tool editor"]').exists()).toBe(false)
  })
  it('keeps the editor open and does not create when schema validation fails', async () => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(emptyPage)
    vi.mocked(validateOpenAPISchema).mockRejectedValue(new Error('Invalid OpenAPI schema'))
    wrapper = mount(CustomToolsPanel)
    await flushPromises()
    await wrapper.get('button[aria-label="Add custom tool"]').trigger('click')
    await wrapper.get('input[aria-label="Tool name"]').setValue('Weather')
    await wrapper.get('textarea[aria-label="OpenAPI schema"]').setValue('{}')
    await wrapper.get('form[aria-label="Custom tool editor"]').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Invalid OpenAPI schema')
    expect(createApiToolProvider).not.toHaveBeenCalled()
    expect(wrapper.find('form[aria-label="Custom tool editor"]').exists()).toBe(true)
  })
})
