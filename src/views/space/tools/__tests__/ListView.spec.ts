import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import ArcoVue, { Message } from '@arco-design/web-vue'
import { createPinia } from 'pinia'
import ListView from '../ListView.vue'
import {
  createApiToolProvider,
  deleteApiToolProvider,
  getApiToolProvider,
  getApiToolProvidersWithPage,
  updateApiToolProvider,
  validateOpenAPISchema,
} from '@/services/api-tool'
import { uploadImage } from '@/services/upload-file'
import type { GetApiToolProvidersWithPageResponse } from '@/models/api-tool'

type ApiToolProvider = GetApiToolProvidersWithPageResponse['data']['list'][number]

vi.mock('@/services/api-tool', () => ({
  createApiToolProvider: vi.fn(),
  deleteApiToolProvider: vi.fn(),
  getApiToolProvider: vi.fn(),
  getApiToolProvidersWithPage: vi.fn(),
  updateApiToolProvider: vi.fn(),
  validateOpenAPISchema: vi.fn(),
}))
vi.mock('@/services/upload-file', () => ({ uploadImage: vi.fn() }))

const ok = <T>(data: T, message = '') => ({ code: 'success', message, data })
const page = (list: ApiToolProvider[], current_page = 1, total_page = 1) =>
  ok({ list, paginator: { current_page, total_page, page_size: 20, total_record: list.length } })
const provider = (id: string): ApiToolProvider => ({
  id,
  name: `Tool ${id}`,
  icon: 'https://example.com/icon.png',
  description: `${id} description`,
  headers: [],
  created_at: 1700000000,
  tools: [
    {
      id: `${id}-forecast`,
      name: 'forecast',
      description: 'Get the forecast',
      inputs: [{ name: 'city', type: 'str', description: 'City name', required: true }],
    },
  ],
})

// jsdom has no IntersectionObserver; capture the callback so tests can reveal the loader.
let revealLoader: () => void = () => {}
class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    revealLoader = () =>
      callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      )
  }
  observe() {}
  disconnect() {}
}

let wrapper: VueWrapper | undefined
let router: Router
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })),
  )
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  vi.mocked(validateOpenAPISchema).mockResolvedValue(ok(null))
})
afterEach(() => {
  wrapper?.unmount()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

async function render(path = '/space/tools', props: { createType?: string } = {}) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/space/tools', name: 'space-tools-list', component: ListView }],
  })
  await router.push(path)
  wrapper = mount(ListView, {
    props,
    global: { plugins: [ArcoVue, router, createPinia()] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}
const body = () => document.body
const button = (text: string) =>
  [...body().querySelectorAll('button')].find((el) => el.textContent?.trim() === text)!
const settle = async () => {
  for (let i = 0; i < 5; i++) await flushPromises()
}
const type = async (selector: string, value: string) => {
  const field = body().querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!
  field.value = value
  field.dispatchEvent(new Event('input'))
  await flushPromises()
}
const NAME = 'input[placeholder="Enter a tool name with a clear meaning"]'
const SCHEMA = 'textarea[placeholder="Enter your OpenAPI schema here"]'
const submit = async () => {
  body().querySelector('form[aria-label="Custom tool editor"]')!.dispatchEvent(new Event('submit'))
  await settle()
}

describe('personal space tools', () => {
  it('loads the next page when the loader comes into view and searches with the query', async () => {
    vi.mocked(getApiToolProvidersWithPage)
      .mockResolvedValueOnce(page([provider('a')], 1, 2))
      .mockResolvedValueOnce(page([provider('b')], 2, 2))
      .mockResolvedValueOnce(page([provider('c')]))
    const view = await render('/space/tools?search_word=wea')
    expect(getApiToolProvidersWithPage).toHaveBeenLastCalledWith(1, 20, 'wea')
    expect(view.text()).toContain('Loading')
    revealLoader()
    await settle()
    expect(getApiToolProvidersWithPage).toHaveBeenLastCalledWith(2, 20, 'wea')
    expect(view.findAll('[data-provider]').map((card) => card.attributes('data-provider'))).toEqual(
      ['a', 'b'],
    )
    expect(view.text()).toContain('All data loaded')
    expect(view.get('[data-provider="a"]').text()).toContain('Provider Tool a · 1 tools')
    expect(view.get('[data-provider="a"]').text()).toMatch(/You · Edited\s*\d{2}-\d{2} \d{2}:\d{2}/)

    await router.push('/space/tools?search_word=sun')
    await settle()
    expect(getApiToolProvidersWithPage).toHaveBeenLastCalledWith(1, 20, 'sun')
    expect(view.findAll('[data-provider]').map((card) => card.attributes('data-provider'))).toEqual(
      ['c'],
    )
  })

  it('shows an error message when the list fails to load', async () => {
    const error = vi.spyOn(Message, 'error')
    vi.mocked(getApiToolProvidersWithPage).mockRejectedValue(new Error('Network down'))
    await render()
    await settle()
    expect(error).toHaveBeenCalledWith('Network down')
  })

  it('shows provider details, updates the provider, and confirms before deleting', async () => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(page([provider('weather')]))
    vi.mocked(getApiToolProvider).mockResolvedValue(
      ok({
        id: 'weather',
        name: 'Weather',
        icon: 'https://example.com/weather.png',
        openapi_schema: '{}',
        headers: [{ key: 'X-Key', value: 'secret' }],
        created_at: 1700000000,
      }),
    )
    vi.mocked(updateApiToolProvider).mockResolvedValue(ok(null, 'Updated'))
    vi.mocked(deleteApiToolProvider).mockResolvedValue(ok(null, 'Deleted'))
    const view = await render()
    await view.get('[data-provider="weather"] .arco-card').trigger('click')
    await settle()
    expect(body().textContent).toContain('City name')
    expect(body().textContent).toContain('Required')

    await button('Edit Tool').click()
    await settle()
    expect(body().textContent).toContain('Update Tool')
    expect(body().querySelector<HTMLInputElement>(NAME)!.value).toBe('Weather')
    await type(NAME, ' Updated Weather ')
    await submit()
    expect(updateApiToolProvider).toHaveBeenCalledWith('weather', {
      name: 'Updated Weather',
      icon: 'https://example.com/weather.png',
      openapi_schema: '{}',
      headers: [{ key: 'X-Key', value: 'secret' }],
    })
    expect(getApiToolProvidersWithPage).toHaveBeenCalledTimes(2)

    await view.get('[data-provider="weather"] .arco-card').trigger('click')
    await button('Edit Tool').click()
    await settle()
    await button('Delete').click()
    await settle()
    expect(body().textContent).toContain('Delete this tool?')
    expect(deleteApiToolProvider).not.toHaveBeenCalled()
    const confirm = body().querySelector('.arco-modal-simple')!
    expect(confirm.textContent).toContain('Cancel')
    ;[...confirm.querySelectorAll('button')]
      .find((el) => el.textContent?.trim() === 'Delete')!
      .click()
    await settle()
    expect(deleteApiToolProvider).toHaveBeenCalledWith('weather')
  })

  it('creates a tool from createType, previews schema tools, and hands createType back', async () => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(page([]))
    vi.mocked(createApiToolProvider).mockResolvedValue(ok(null, 'Created'))
    const view = await render('/space/tools', { createType: 'tool' })
    expect(body().textContent).toContain('Create Tool')
    const schema = JSON.stringify({
      paths: { '/weather': { get: { operationId: 'getWeather', description: 'Forecast' } } },
    })
    await type(NAME, 'Weather')
    await type(SCHEMA, schema)
    expect(body().textContent).toContain('getWeather')
    await button('Add Header').click()
    await flushPromises()
    await type('input[placeholder="Enter the header key"]', 'Authorization')
    await type('input[placeholder="Enter the header value"]', 'Bearer x')
    await submit()
    expect(createApiToolProvider).toHaveBeenCalledWith({
      name: 'Weather',
      icon: 'https://picsum.photos/400',
      openapi_schema: schema,
      headers: [{ key: 'Authorization', value: 'Bearer x' }],
    })
    expect(view.emitted('update-create-type')).toEqual([['']])
  })

  it('validates the schema when the textarea loses focus', async () => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(page([]))
    vi.mocked(validateOpenAPISchema).mockRejectedValue(new Error('Invalid OpenAPI schema'))
    const error = vi.spyOn(Message, 'error')
    await render('/space/tools', { createType: 'tool' })
    await type(SCHEMA, '{}')
    body().querySelector(SCHEMA)!.dispatchEvent(new Event('blur'))
    await settle()
    expect(validateOpenAPISchema).toHaveBeenCalledWith('{}')
    expect(error).toHaveBeenCalledWith('Invalid OpenAPI schema')
  })

  it('requires a name and a schema before calling the backend', async () => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(page([]))
    await render('/space/tools', { createType: 'tool' })
    await submit()
    expect(body().textContent).toContain('The tool name is required')
    expect(body().textContent).toContain('The OpenAPI schema is required')
    expect(createApiToolProvider).not.toHaveBeenCalled()
  })

  it('uploads the icon and saves the returned image URL', async () => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(page([]))
    vi.mocked(uploadImage).mockResolvedValue(ok({ image_url: 'https://cdn.example.com/a.png' }))
    vi.mocked(createApiToolProvider).mockResolvedValue(ok(null))
    await render('/space/tools', { createType: 'tool' })
    // The default icon fills the single slot; remove it before uploading a new one.
    body().querySelector<HTMLElement>('.arco-upload-icon-remove')!.click()
    await settle()
    const input = body().querySelector<HTMLInputElement>('input[type="file"]')!
    const file = new File(['png'], 'icon.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [file] })
    input.dispatchEvent(new Event('change'))
    await settle()
    expect(uploadImage).toHaveBeenCalledWith(file)
    await type(NAME, 'Weather')
    await type(SCHEMA, '{}')
    await submit()
    expect(createApiToolProvider).toHaveBeenCalledWith(
      expect.objectContaining({ icon: 'https://cdn.example.com/a.png' }),
    )
  })

  it('limits tool names to the 30 characters the backend accepts', async () => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(page([]))
    await render('/space/tools', { createType: 'tool' })
    await type(NAME, 'x'.repeat(40))
    expect(body().querySelector<HTMLInputElement>(NAME)!.value).toHaveLength(30)
    expect(body().textContent).toContain('30/30')
  })
})
