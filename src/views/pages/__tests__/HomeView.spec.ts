import { expect, it } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ArcoVue from '@arco-design/web-vue'
import HomeView from '../HomeView.vue'
import { useAccountStore } from '@/stores/account'

const mountHome = () =>
  mount(HomeView, { global: { plugins: [ArcoVue], stubs: { RouterLink: RouterLinkStub } } })

it('shows the signed-in account from the store', async () => {
  setActivePinia(createPinia())
  const store = useAccountStore()
  store.account = { id: 'u1', name: 'Ada', email: 'ada@example.com', avatar: '' }
  const wrapper = mountHome()

  expect(wrapper.text()).toContain('Ada')
  expect(wrapper.text()).toContain('ada@example.com')

  // The view reads the store reactively, so a signed-out store hides the account.
  store.clear()
  await wrapper.vm.$nextTick()
  expect(wrapper.text()).not.toContain('ada@example.com')
  expect(wrapper.text()).toContain('Account details are unavailable.')
})
