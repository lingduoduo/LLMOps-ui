import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DraftConfigPanel from '../DraftConfigPanel.vue'

afterEach(() => vi.unstubAllGlobals())

describe('draft configuration', () => {
  it('loads the draft and saves only the edited prompt and conversation rounds', async () => {
    let saved: unknown
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: RequestInit) => {
        expect(url).toBe('/api/apps/example/draft-app-config')
        if (options.method === 'POST') {
          saved = JSON.parse(options.body as string)
          return new Response('{"code":"success","message":"Saved","data":{}}')
        }
        return new Response(
          JSON.stringify({
            code: 'success',
            message: '',
            data: {
              preset_prompt: 'Original prompt',
              dialog_round: 3,
              model_config: { provider: 'openai', model: 'gpt-4o-mini' },
              tools: [],
              datasets: [],
              workflows: [],
            },
          }),
        )
      }),
    )
    const wrapper = mount(DraftConfigPanel, { props: { appId: 'example' } })
    await flushPromises()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Original prompt')
    await wrapper.get('textarea').setValue('Edited prompt')
    await wrapper.get('input[type="number"]').setValue('5')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(saved).toEqual({ preset_prompt: 'Edited prompt', dialog_round: 5 })
    expect(wrapper.get('[role="status"]').text()).toContain('saved')
    wrapper.unmount()
  })
})
