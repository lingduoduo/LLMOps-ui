import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import View from '../ApiKeysView.vue'
import * as service from '@/services/api-key'
vi.mock('@/services/api-key', () => ({
  getApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  updateApiKey: vi.fn(),
  toggleApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
}))
const result = (secret = 'secret-key') => ({
  list: [
    {
      id: '1',
      api_key: secret,
      remark: 'Production',
      is_active: true,
      created_at: 0,
      updated_at: 0,
    },
  ],
  paginator: { current_page: 1, total_page: 2, total_record: 21, page_size: 20 },
})
afterEach(() => vi.resetAllMocks())
it('masks keys until individually revealed and hides them on reload', async () => {
  vi.mocked(service.getApiKeys).mockResolvedValue(result())
  const wrapper = mount(View)
  await flushPromises()
  expect(wrapper.text()).not.toContain('secret-key')
  await wrapper.get('[aria-label="Reveal key for Production"]').trigger('click')
  expect(wrapper.text()).toContain('secret-key')
  await wrapper.get('[data-testid="refresh"]').trigger('click')
  await flushPromises()
  expect(wrapper.text()).not.toContain('secret-key')
  wrapper.unmount()
})
it('keeps failed mutations visible and prevents duplicate submissions', async () => {
  vi.mocked(service.getApiKeys).mockResolvedValue(result())
  let reject!: (reason: Error) => void
  vi.mocked(service.createApiKey).mockImplementation(
    () =>
      new Promise((_, r) => {
        reject = r
      }),
  )
  const wrapper = mount(View)
  await flushPromises()
  await wrapper.get('[data-testid="create"]').trigger('click')
  await wrapper.get('input[name="remark"]').setValue('New')
  await wrapper.get('form').trigger('submit')
  await wrapper.get('form').trigger('submit')
  expect(service.createApiKey).toHaveBeenCalledTimes(1)
  reject(new Error('Denied'))
  await flushPromises()
  expect(wrapper.text()).toContain('Denied')
  expect(wrapper.find('form').exists()).toBe(true)
  wrapper.unmount()
})
it('discards stale loads after refresh', async () => {
  let resolve!: (value: ReturnType<typeof result>) => void
  vi.mocked(service.getApiKeys)
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    .mockResolvedValue(result('new-key'))
  const wrapper = mount(View)
  await wrapper.get('[data-testid="refresh"]').trigger('click')
  await flushPromises()
  resolve(result('old-key'))
  await flushPromises()
  await wrapper.get('[aria-label="Reveal key for Production"]').trigger('click')
  expect(wrapper.text()).toContain('new-key')
  expect(wrapper.text()).not.toContain('old-key')
  wrapper.unmount()
})

it('does not refresh secrets after a mutation completes in a different session', async () => {
  const { setCredential, clearCredential } = await import('@/utils/auth')
  setCredential({ access_token: 'first', expire_at: Date.now() / 1000 + 1000 })
  vi.mocked(service.getApiKeys).mockResolvedValue(result())
  let resolve!: (value: Awaited<ReturnType<typeof service.createApiKey>>) => void
  vi.mocked(service.createApiKey).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  const wrapper = mount(View)
  await flushPromises()
  await wrapper.get('[data-testid="create"]').trigger('click')
  await wrapper.get('form').trigger('submit')
  setCredential({ access_token: 'second', expire_at: Date.now() / 1000 + 1000 })
  resolve({ code: 'success', message: '', data: null })
  await flushPromises()
  expect(service.getApiKeys).toHaveBeenCalledTimes(1)
  expect(wrapper.text()).not.toContain('API key created.')
  wrapper.unmount()
  clearCredential()
})

it('preserves the row and edit form when update or status changes fail', async () => {
  vi.mocked(service.getApiKeys).mockResolvedValue(result())
  vi.mocked(service.updateApiKey).mockRejectedValue(new Error('Edit denied'))
  vi.mocked(service.toggleApiKey).mockRejectedValue(new Error('Status denied'))
  const wrapper = mount(View)
  await flushPromises()
  const button = (label: string) => wrapper.findAll('button').find((b) => b.text() === label)!
  await button('Edit').trigger('click')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(wrapper.text()).toContain('Edit denied')
  expect(wrapper.find('form').exists()).toBe(true)
  await button('Cancel').trigger('click')
  await button('Deactivate').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('Status denied')
  expect(button('Deactivate').exists()).toBe(true)
  wrapper.unmount()
})
it('requires delete confirmation and keeps a failed deletion retryable', async () => {
  vi.mocked(service.getApiKeys).mockResolvedValue(result())
  vi.mocked(service.deleteApiKey).mockRejectedValue(new Error('Delete denied'))
  const wrapper = mount(View)
  await flushPromises()
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Delete')!
    .trigger('click')
  expect(service.deleteApiKey).not.toHaveBeenCalled()
  await wrapper.get('[role="dialog"] button').trigger('click')
  await flushPromises()
  expect(wrapper.get('[role="dialog"]').text()).toContain('Delete denied')
  expect(wrapper.text()).toContain('Production')
  wrapper.unmount()
})

it('returns to the first page after creating a key from page two', async () => {
  vi.mocked(service.getApiKeys).mockResolvedValue(result())
  vi.mocked(service.createApiKey).mockResolvedValue({ code: 'success', message: '', data: null })
  const wrapper = mount(View)
  await flushPromises()
  await wrapper
    .findAll('button')
    .find((b) => b.text() === 'Next')!
    .trigger('click')
  await flushPromises()
  expect(service.getApiKeys).toHaveBeenLastCalledWith(2, expect.any(AbortSignal))
  await wrapper.get('[data-testid="create"]').trigger('click')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(service.getApiKeys).toHaveBeenLastCalledWith(1, expect.any(AbortSignal))
  expect(wrapper.text()).toContain('Page 1 of 2')
  wrapper.unmount()
})

it('focuses delete cancellation, traps Tab, and restores focus after Escape', async () => {
  vi.mocked(service.getApiKeys).mockResolvedValue(result())
  const wrapper = mount(View, { attachTo: document.body })
  await flushPromises()
  const trigger = wrapper.findAll('button').find((b) => b.text() === 'Delete')!
  ;(trigger.element as HTMLButtonElement).focus()
  await trigger.trigger('click')
  await flushPromises()
  const dialog = wrapper.get('[role="dialog"]')
  const buttons = dialog.findAll('button')
  expect(document.activeElement).toBe(buttons[1]!.element)
  await buttons[1]!.trigger('keydown', { key: 'Tab' })
  expect(document.activeElement).toBe(buttons[0]!.element)
  await buttons[0]!.trigger('keydown', { key: 'Escape' })
  await flushPromises()
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  expect(document.activeElement).toBe(trigger.element)
  wrapper.unmount()
})
