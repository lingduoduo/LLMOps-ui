import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import DetailView from '../DetailView.vue'

function reply(content: string) {
  return new Response(
    `event: agent_message\ndata:${JSON.stringify({ event: 'agent_message', answer: content })}\n\nevent: agent_end\ndata:{"event":"agent_end"}\n\n`,
    { headers: { 'Content-Type': 'text/event-stream' } },
  )
}

let wrapper: VueWrapper | undefined

afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
})

async function render(includeConfig = false) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/space/apps', component: { template: '<div />' } },
      { path: '/space/apps/:app_id', component: DetailView },
    ],
  })
  await router.push('/space/apps/first')
  await router.isReady()
  wrapper = mount(DetailView, {
    global: { plugins: [router], stubs: { DraftConfigPanel: !includeConfig } },
  })
  return { wrapper, router }
}

async function send(wrapper: VueWrapper, query = 'Hello') {
  await wrapper.get('input[aria-label="Question"]').setValue(query)
  await wrapper.get('input[aria-label="Question"]').trigger('keyup.enter')
  await flushPromises()
}

describe('debug chat', () => {
  it('preserves the transcript when the backend conversation cannot be reset', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/delete-debug-conversation')
          ? new Response('{"message":"Reset failed"}', { status: 503 })
          : reply('Previous answer'),
      ),
    )
    const { wrapper } = await render()
    await send(wrapper)
    await wrapper.get('button[aria-label="Clear conversation"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Reset failed')
    expect(wrapper.findAll('[data-role="ai"]').map((node) => node.text())).toEqual([
      'Previous answer',
    ])
  })

  it('waits for a pending draft save before sending the debug request', async () => {
    let finishSave!: (response: Response) => void
    let conversations = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: RequestInit) => {
        if (url.endsWith('/draft-app-config')) {
          if (options.method === 'POST')
            return new Promise<Response>((resolve) => {
              finishSave = resolve
            })
          return new Response(
            JSON.stringify({
              code: 'success',
              message: '',
              data: { preset_prompt: 'Original', dialog_round: 3 },
            }),
          )
        }
        conversations++
        return reply('Saved configuration answer')
      }),
    )
    const { wrapper } = await render(true)
    await flushPromises()
    await wrapper.get('textarea').setValue('Updated instructions')
    await wrapper.get('form').trigger('submit')
    await send(wrapper)
    expect(conversations).toBe(0)
    finishSave(new Response('{"code":"success","message":"","data":{}}'))
    await flushPromises()
    await send(wrapper)
    expect(conversations).toBe(1)
    expect(wrapper.text()).toContain('Saved configuration answer')
  })

  it('shows backend failure messages and restores the query for retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: 'fail', message: 'Model offline', data: null })),
        ),
    )
    const { wrapper } = await render()
    await send(wrapper)
    expect(wrapper.get('[role="alert"]').text()).toContain('Model offline')
    expect((wrapper.get('input[aria-label="Question"]').element as HTMLInputElement).value).toBe(
      'Hello',
    )
    expect(wrapper.findAll('[data-role="ai"]')).toHaveLength(0)
  })

  it('rejects whitespace-only queries before creating a message', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { wrapper } = await render()
    await send(wrapper, '   ')
    expect(fetch).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toMatch(/empty/i)
  })

  it('discards a reply that arrives after the user clears the chat', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/delete-debug-conversation')
          ? Promise.resolve(new Response('{"code":"success","data":{},"message":""}'))
          : new Promise<Response>((resolve) => {
              finish = resolve
            }),
      ),
    )
    const { wrapper } = await render()
    await send(wrapper)
    await wrapper.get('button[aria-label="Clear conversation"]').trigger('click')
    finish(reply('Late reply'))
    await flushPromises()
    expect(wrapper.text()).not.toContain('Late reply')
    expect(wrapper.findAll('[data-role]')).toHaveLength(0)
  })

  it('clears chat and discards stale replies when the app ID changes', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/delete-debug-conversation')
          ? Promise.resolve(new Response('{"code":"success","data":{},"message":""}'))
          : new Promise<Response>((resolve) => {
              finish = resolve
            }),
      ),
    )
    const { wrapper, router } = await render()
    await send(wrapper)
    await router.push('/space/apps/second')
    finish(reply('Wrong app reply'))
    await flushPromises()
    expect(wrapper.text()).not.toContain('Wrong app reply')
    expect(wrapper.findAll('[data-role]')).toHaveLength(0)
  })

  it('renders repeated replies as separate messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => reply('Same reply')),
    )
    const { wrapper } = await render()
    await send(wrapper)
    await send(wrapper)
    expect(wrapper.findAll('[data-role="ai"]').map((node) => node.text())).toEqual([
      'Same reply',
      'Same reply',
    ])
  })
})
