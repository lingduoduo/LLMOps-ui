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

async function render(path = '/space/tools', createType = '') {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/space/tools', name: 'space-tools-list', component: ListView }],
  })
  await router.push(path)
  wrapper = mount(ListView, {
    props: { createType },
    global: { plugins: [ArcoVue, router, createPinia()] },
    attachTo: document.body,
  })
  await settle()
  return wrapper
}
const body = () => document.body
// Arco passes the live form model as `values`, and the page resets it after saving,
// so record a copy of what was sent at call time.
const sent: unknown[][] = []
const recordCalls =
  () =>
  (...args: unknown[]) => {
    sent.push(JSON.parse(JSON.stringify(args)))
    return Promise.resolve(ok(null, 'Saved'))
  }
const button = (text: string, root: ParentNode = body()) =>
  [...root.querySelectorAll('button')].find((el) => el.textContent?.trim() === text)!
const settle = async () => {
  for (let i = 0; i < 5; i++) await flushPromises()
}
const type = async (selector: string, value: string) => {
  const field = body().querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!
  field.value = value
  field.dispatchEvent(new Event('input'))
  await flushPromises()
}
const NAME = 'input[placeholder="Enter a tool name and make sure its meaning is clear"]'
const SCHEMA = 'textarea[placeholder="Enter your OpenAPI schema here"]'
const submit = async () => {
  body().querySelector('.arco-modal form')!.dispatchEvent(new Event('submit'))
  await settle()
}
const cards = (view: VueWrapper) =>
  view.findAll('.arco-card-body .text-base').map((el) => el.text())
// Scroll the list container to its bottom (jsdom has no layout, so set the sizes).
const scrollToBottom = async (view: VueWrapper) => {
  const list = view.get('.arco-spin').element as HTMLElement
  Object.defineProperties(list, {
    scrollTop: { value: 600, configurable: true },
    scrollHeight: { value: 1000, configurable: true },
    clientHeight: { value: 400, configurable: true },
  })
  list.dispatchEvent(new Event('scroll'))
  await settle()
}

describe('personal space tools', () => {
  it('loads the next page when the list scrolls to the bottom and reloads on search', async () => {
    vi.mocked(getApiToolProvidersWithPage)
      .mockResolvedValueOnce(page([provider('a')], 1, 2))
      .mockResolvedValueOnce(page([provider('b')], 2, 2))
      .mockResolvedValueOnce(page([provider('c')]))
    const view = await render('/space/tools?search_word=wea')
    expect(getApiToolProvidersWithPage).toHaveBeenLastCalledWith(1, 20, 'wea')
    expect(view.text()).toContain('Loading')
    expect(view.text()).toContain('Provider Tool a · 1 tools')

    await scrollToBottom(view)
    expect(getApiToolProvidersWithPage).toHaveBeenLastCalledWith(2, 20, 'wea')
    expect(cards(view)).toEqual(['Tool a', 'Tool b'])
    expect(view.text()).toContain('All data loaded')

    await router.push('/space/tools?search_word=sun')
    await settle()
    expect(getApiToolProvidersWithPage).toHaveBeenLastCalledWith(1, 20, 'sun')
    expect(cards(view)).toEqual(['Tool c'])
  })

  it('shows the empty state when there are no tools', async () => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(page([]))
    const view = await render()
    expect(view.text()).toContain('No API tools available')
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
    sent.length = 0
    vi.mocked(updateApiToolProvider).mockImplementation(recordCalls())
    vi.mocked(deleteApiToolProvider).mockResolvedValue(ok(null, 'Deleted'))
    const view = await render()
    await view.get('.arco-card').trigger('click')
    await settle()
    expect(body().textContent).toContain('Tool Details')
    expect(body().textContent).toContain('City name')
    expect(body().textContent).toContain('Required')

    await button('Edit Tool').click()
    await settle()
    expect(body().textContent).toContain('Update Tool')
    expect(body().querySelector<HTMLInputElement>(NAME)!.value).toBe('Weather')
    await type(NAME, 'Updated Weather')
    await submit()
    expect(sent).toEqual([
      [
        'weather',
        {
          icon: 'https://example.com/weather.png',
          name: 'Updated Weather',
          openapi_schema: '{}',
          headers: [{ key: 'X-Key', value: 'secret' }],
        },
      ],
    ])
    expect(getApiToolProvidersWithPage).toHaveBeenCalledTimes(2)

    await view.get('.arco-card').trigger('click')
    await button('Edit Tool').click()
    await settle()
    await button('Delete').click()
    await settle()
    const confirm = body().querySelector('.arco-modal-simple')!
    expect(confirm.textContent).toContain('Delete this tool?')
    expect(deleteApiToolProvider).not.toHaveBeenCalled()
    button('OK', confirm).click()
    await settle()
    expect(deleteApiToolProvider).toHaveBeenCalledWith('weather')
  })

  it('creates a tool when createType is tool and previews the schema tools', async () => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(page([]))
    sent.length = 0
    vi.mocked(createApiToolProvider).mockImplementation(recordCalls())
    const view = await render('/space/tools', 'tool')
    expect(body().textContent).toContain('Create Tool')
    const schema = JSON.stringify({
      paths: { '/weather': { get: { operationId: 'getWeather', description: 'Forecast' } } },
    })
    await type(NAME, 'Weather')
    await type(SCHEMA, schema)
    expect(body().textContent).toContain('getWeather')
    await submit()
    expect(sent).toEqual([
      [{ icon: 'https://picsum.photos/400', name: 'Weather', openapi_schema: schema, headers: [] }],
    ])
    expect(view.emitted('update-create-type')).toEqual([['']])
  })

  it('validates the schema when the textarea loses focus', async () => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(page([]))
    await render('/space/tools', 'tool')
    await type(SCHEMA, '{}')
    body().querySelector(SCHEMA)!.dispatchEvent(new Event('blur'))
    await settle()
    expect(validateOpenAPISchema).toHaveBeenCalledWith('{}')
  })

  it('requires a name and a schema before calling the backend', async () => {
    vi.mocked(getApiToolProvidersWithPage).mockResolvedValue(page([]))
    await render('/space/tools', 'tool')
    await submit()
    expect(body().textContent).toContain('The tool name cannot be empty')
    expect(body().textContent).toContain('The OpenAPI schema cannot be empty')
    expect(createApiToolProvider).not.toHaveBeenCalled()
  })
})
