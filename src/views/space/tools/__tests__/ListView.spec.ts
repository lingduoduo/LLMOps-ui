import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import ArcoVue from '@arco-design/web-vue'
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
import type { ApiToolProvider } from '@/models/api-tool'

vi.mock('@/services/api-tool', () => ({
  createApiToolProvider: vi.fn(),
  deleteApiToolProvider: vi.fn(),
  getApiToolProvider: vi.fn(),
  getApiToolProvidersWithPage: vi.fn(),
  updateApiToolProvider: vi.fn(),
  validateOpenAPISchema: vi.fn(),
}))

const ok = <T>(data: T) => ({ code: 'success', message: '', data })
const page = (list: ApiToolProvider[], current_page = 1, total_page = 1) =>
  ok({ list, paginator: { current_page, total_page, page_size: 20, total_record: list.length } })
const provider = (id: string): ApiToolProvider => ({
  id,
  name: `Tool ${id}`,
  icon: '',
  description: `${id} description`,
  headers: [],
  created_at: 1700000000,
  tools: [
    {
      name: 'forecast',
      description: 'Get the forecast',
      inputs: [{ name: 'city', type: 'str', description: 'City name', required: true }],
    },
  ],
})

let wrapper: VueWrapper | undefined
let router: Router
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })),
  )
  vi.mocked(validateOpenAPISchema).mockResolvedValue(ok(null))
})
afterEach(() => {
  wrapper?.unmount()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

async function render(path = '/space/tools') {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/space/tools', name: 'space-tools-list', component: ListView }],
  })
  await router.push(path)
  wrapper = mount(ListView, {
    global: { plugins: [ArcoVue, router, createPinia()] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}
const body = () => document.body
const button = (text: string) =>
  [...body().querySelectorAll('button')].find((el) => el.textContent?.trim() === text)!
const type = async (selector: string, value: string) => {
  const field = body().querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!
  field.value = value
  field.dispatchEvent(new Event('input'))
  await flushPromises()
}
const submit = async () => {
  body().querySelector('form[aria-label="Custom tool editor"]')!.dispatchEvent(new Event('submit'))
  await flushPromises()
}

describe('personal space tools', () => {
  it('loads more providers page by page and searches with the shared query', async () => {
    vi.mocked(getApiToolProvidersWithPage)
      .mockResolvedValueOnce(page([provider('a')], 1, 2))
      .mockResolvedValueOnce(page([provider('b')], 2, 2))
      .mockResolvedValueOnce(page([provider('c')]))
    const view = await render('/space/tools?search_word=%20wea%20')
    expect(getApiToolProvidersWithPage).toHaveBeenLastCalledWith(1, 20, 'wea')
    await button('Load more').click()
    await flushPromises()
    expect(view.findAll('[data-provider]').map((card) => card.attributes('data-provider'))).toEqual(
      ['a', 'b'],
    )
    expect(view.text()).toContain('All tools loaded')
    expect(view.get('[data-provider="a"]').text()).toMatch(/You · Edited\s*\d{2}-\d{2} \d{2}:\d{2}/)
    await router.push('/space/tools?search_word=sun')
    await flushPromises()
    expect(getApiToolProvidersWithPage).toHaveBeenLastCalledWith(1, 20, 'sun')
    expect(view.findAll('[data-provider]').map((card) => card.attributes('data-provider'))).toEqual(
      ['c'],
    )
  })

  it('shows provider details, edits the provider, and confirms before deleting', async () => {
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
    vi.mocked(updateApiToolProvider).mockResolvedValue(ok(null))
    vi.mocked(deleteApiToolProvider).mockResolvedValue(ok(null))
    const view = await render()
    await view.get('button[aria-label="View Tool weather tools"]').trigger('click')
    await flushPromises()
    expect(body().textContent).toContain('City name')
    expect(body().textContent).toContain('Required')

    await button('Edit Tool').click()
    await flushPromises()
    const name = body().querySelector<HTMLInputElement>(
      'input[placeholder="Enter a clear, descriptive tool name"]',
    )!
    expect(name.value).toBe('Weather')
    await type('input[placeholder="Enter a clear, descriptive tool name"]', ' Updated Weather ')
    await submit()
    expect(validateOpenAPISchema).toHaveBeenCalledWith('{}')
    expect(updateApiToolProvider).toHaveBeenCalledWith('weather', {
      name: 'Updated Weather',
      icon: 'https://example.com/weather.png',
      openapi_schema: '{}',
      headers: [{ key: 'X-Key', value: 'secret' }],
    })
    expect(getApiToolProvidersWithPage).toHaveBeenCalledTimes(2)

    await view.get('button[aria-label="View Tool weather tools"]').trigger('click')
    await button('Edit Tool').click()
    await flushPromises()
    await button('Delete').click()
    await flushPromises()
    expect(deleteApiToolProvider).not.toHaveBeenCalled()
    await button('Confirm delete').click()
    await flushPromises()
    expect(deleteApiToolProvider).toHaveBeenCalledWith('weather')
  })

  it('opens the create dialog from the query, previews schema tools, and creates', async () => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(page([]))
    vi.mocked(createApiToolProvider).mockResolvedValue(ok(null))
    await render('/space/tools?create=tool')
    expect(body().textContent).toContain('Create Tool')
    const schema = JSON.stringify({
      openapi: '3.0.0',
      paths: { '/weather': { get: { operationId: 'getWeather', description: 'Forecast' } } },
    })
    await type(
      'input[placeholder="https://example.com/icon.png"]',
      ' https://example.com/weather.png ',
    )
    await type('input[placeholder="Enter a clear, descriptive tool name"]', 'Weather')
    await type('textarea[placeholder="Paste your OpenAPI schema here"]', schema)
    expect(body().textContent).toContain('getWeather')
    await button('Add header').click()
    await flushPromises()
    await type('input[aria-label="Header 1 key"]', 'Authorization')
    await type('input[aria-label="Header 1 value"]', 'Bearer x')
    await submit()
    expect(createApiToolProvider).toHaveBeenCalledWith({
      name: 'Weather',
      icon: 'https://example.com/weather.png',
      openapi_schema: schema,
      headers: [{ key: 'Authorization', value: 'Bearer x' }],
    })
    expect(router.currentRoute.value.query.create).toBeUndefined()
  })

  it('keeps the dialog open and does not create when schema validation fails', async () => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(page([]))
    vi.mocked(validateOpenAPISchema).mockRejectedValue(new Error('Invalid OpenAPI schema'))
    await render('/space/tools?create=tool')
    await type(
      'input[placeholder="https://example.com/icon.png"]',
      'https://example.com/weather.png',
    )
    await type('input[placeholder="Enter a clear, descriptive tool name"]', 'Weather')
    await type('textarea[placeholder="Paste your OpenAPI schema here"]', '{}')
    await submit()
    expect(body().querySelector('[role="alert"]')!.textContent).toContain('Invalid OpenAPI schema')
    expect(createApiToolProvider).not.toHaveBeenCalled()
    expect(body().querySelector('form[aria-label="Custom tool editor"]')).not.toBeNull()
  })

  it.each([
    ['', 'Weather', 'Enter an icon URL, a tool name, and an OpenAPI schema.'],
    ['not a url', 'Weather', 'The icon must be a valid http(s) URL.'],
    ['javascript:alert(1)', 'Weather', 'The icon must be a valid http(s) URL.'],
  ])('rejects icon %j before calling the backend', async (icon, name, error) => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(page([]))
    await render('/space/tools?create=tool')
    await type('input[placeholder="https://example.com/icon.png"]', icon)
    await type('input[placeholder="Enter a clear, descriptive tool name"]', name)
    await type('textarea[placeholder="Paste your OpenAPI schema here"]', '{}')
    await submit()
    expect(body().querySelector('[role="alert"]')!.textContent).toContain(error)
    expect(validateOpenAPISchema).not.toHaveBeenCalled()
    expect(createApiToolProvider).not.toHaveBeenCalled()
  })

  it('limits tool names to the 30 characters the backend accepts', async () => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(page([]))
    await render('/space/tools?create=tool')
    await type('input[placeholder="Enter a clear, descriptive tool name"]', 'x'.repeat(40))
    const name = body().querySelector<HTMLInputElement>(
      'input[placeholder="Enter a clear, descriptive tool name"]',
    )!
    expect(name.value).toHaveLength(30)
    expect(body().textContent).toContain('30/30')
  })
})
