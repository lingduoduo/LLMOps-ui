import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { App } from 'vue'

let app: App | undefined
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
  sessionStorage.clear()
  vi.resetModules()
})

it('registers Arco components and icons globally and mounts the app', async () => {
  document.body.innerHTML = '<div id="app"></div>'
  app = (await import('@/main')).default
  const { default: router } = await import('@/router')
  await router.isReady()
  await flushPromises()

  expect(app.component('AButton')).toBeDefined()
  expect(app.component('AAvatar')).toBeDefined()
  expect(app.component('IconUser')).toBeDefined()
  // Signed out, so the router guard sends the visitor to the login page.
  expect(router.currentRoute.value.name).toBe('auth-login')
  expect(document.body.textContent).toContain('Sign in to LLMOps')
})

it('renders Arco components used by templates', async () => {
  document.body.innerHTML = '<div id="app"></div>'
  app = (await import('@/main')).default
  const { default: router } = await import('@/router')
  sessionStorage.setItem(
    'llmops.credential',
    JSON.stringify({ access_token: 't', expire_at: Math.floor(Date.now() / 1000) + 3600 }),
  )
  await router.push('/about')
  await flushPromises()

  expect(document.querySelector('.about .arco-btn-primary')?.textContent).toContain(
    'Register/Login',
  )
  expect(document.querySelector('.about .arco-avatar svg.arco-icon-user')).not.toBeNull()
})
