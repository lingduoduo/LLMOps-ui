import { afterEach, describe, expect, it, vi } from 'vitest'
import { isLogin } from '@/utils/auth'

afterEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('dev admin login', () => {
  it('creates a local session for admin/admin and skips the backend on logout', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { isDevSession, logout, passwordLogin } = await import('../auth')
    await passwordLogin('admin', 'admin')
    expect(isLogin()).toBe(true)
    expect(isDevSession()).toBe(true)
    await logout()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('is disabled outside the dev server', async () => {
    vi.stubEnv('DEV', false)
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ code: 'fail', message: 'Invalid credentials', data: {} })),
    )
    vi.stubGlobal('fetch', fetch)
    const { passwordLogin } = await import('../auth')
    await expect(passwordLogin('admin', 'admin')).rejects.toThrow('Invalid credentials')
    expect(fetch).toHaveBeenCalledOnce()
    expect(isLogin()).toBe(false)
  })
})
