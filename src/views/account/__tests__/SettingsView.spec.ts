import { afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useAccountStore } from '@/stores/account'
import SettingsView from '../SettingsView.vue'
let wrapper: VueWrapper
function render() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useAccountStore()
  store.account = { id: 'a', name: 'Original', email: 'a@example.com', avatar: '' }
  wrapper = mount(SettingsView, { global: { plugins: [pinia] } })
  return store
}
afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
})
it('saves a name independently and reflects only successful changes', async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ code: 'success', data: {} })))
  vi.stubGlobal('fetch', fetch)
  const store = render()
  await wrapper.get('#account-name').setValue('Updated')
  await wrapper.get('[data-test="name-form"]').trigger('submit')
  await flushPromises()
  expect(store.account?.name).toBe('Updated')
  expect(wrapper.text()).toContain('Name saved')
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('validates password confirmation and preserves the old profile after failure', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ code: 'fail', message: 'Not allowed' }))),
  )
  const store = render()
  await wrapper.get('#account-name').setValue('Updated')
  await wrapper.get('[data-test="name-form"]').trigger('submit')
  await flushPromises()
  expect(store.account?.name).toBe('Original')
  expect(wrapper.text()).toContain('Not allowed')
  await wrapper.get('#password').setValue('password123')
  await wrapper.get('#confirm-password').setValue('password124')
  await wrapper.get('[data-test="password-form"]').trigger('submit')
  expect(wrapper.text()).toContain('Passwords do not match')
})

it('clears passwords only after a successful change', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ code: 'success', data: {} }))),
  )
  render()
  await wrapper.get('#password').setValue('password123')
  await wrapper.get('#confirm-password').setValue('password123')
  await wrapper.get('[data-test="password-form"]').trigger('submit')
  await flushPromises()
  expect((wrapper.get('#password').element as HTMLInputElement).value).toBe('')
  expect((wrapper.get('#confirm-password').element as HTMLInputElement).value).toBe('')
  expect(wrapper.text()).toContain('Password saved')
})
it('blocks invalid values before sending a request', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render()
  await wrapper.get('#account-name').setValue('ab')
  await wrapper.get('[data-test="name-form"]').trigger('submit')
  await wrapper.get('#account-avatar').setValue('javascript:alert(1)')
  await wrapper.get('[data-test="avatar-form"]').trigger('submit')
  await wrapper.get('#password').setValue('12345678')
  await wrapper.get('[data-test="password-form"]').trigger('submit')
  expect(fetch).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('3–30')
  expect(wrapper.text()).toContain('absolute http or https')
  expect(wrapper.text()).toContain('including a letter')
})
it('prevents duplicate saves and ignores a response after the account changes', async () => {
  let resolve!: (response: Response) => void
  const fetch = vi.fn(
    () =>
      new Promise<Response>((done) => {
        resolve = done
      }),
  )
  vi.stubGlobal('fetch', fetch)
  const store = render()
  await wrapper.get('#account-name').setValue('Updated')
  await wrapper.get('[data-test="name-form"]').trigger('submit')
  await wrapper.get('[data-test="name-form"]').trigger('submit')
  expect(fetch).toHaveBeenCalledTimes(1)
  store.account = { id: 'b', name: 'Other user', email: 'b@example.com', avatar: '' }
  resolve(new Response(JSON.stringify({ code: 'success', data: {} })))
  await flushPromises()
  expect(store.account.name).toBe('Other user')
  expect(wrapper.text()).not.toContain('Name saved')
})
it('ignores a successful response after unmount', async () => {
  let resolve!: (response: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    ),
  )
  const store = render()
  await wrapper.get('#account-name').setValue('Updated')
  await wrapper.get('[data-test="name-form"]').trigger('submit')
  wrapper.unmount()
  resolve(new Response(JSON.stringify({ code: 'success', data: {} })))
  await flushPromises()
  expect(store.account?.name).toBe('Original')
})
