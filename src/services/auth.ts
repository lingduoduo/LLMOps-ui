import { post } from '@/utils/request'
import { getAccessToken, setCredential, type Credential } from '@/utils/auth'
import type { BaseResponse } from '@/models/base'
import type { GetCurrentUserResponse } from '@/models/account'

// Local development only: `import.meta.env.DEV` is false in production builds, so this
// account cannot be used outside the Vite dev server and is dropped from the bundle.
export const DEV_LOGIN_ENABLED = import.meta.env.DEV
const DEV_USERNAME = 'admin'
const DEV_PASSWORD = 'admin'
const DEV_ACCESS_TOKEN = 'dev-admin-token'
export const DEV_ACCOUNT: GetCurrentUserResponse['data'] = {
  id: 'dev-admin',
  name: 'Admin (dev)',
  email: 'admin@localhost',
  avatar: '',
}

export const isDevSession = () => DEV_LOGIN_ENABLED && getAccessToken() === DEV_ACCESS_TOKEN

export const passwordLogin = async (email: string, password: string) => {
  if (DEV_LOGIN_ENABLED && email === DEV_USERNAME && password === DEV_PASSWORD) {
    setCredential({
      access_token: DEV_ACCESS_TOKEN,
      expire_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    })
    return
  }
  const response = await post<BaseResponse<Credential>>('/auth/password-login', {
    auth: false,
    body: { email, password },
  })
  setCredential(response.data)
}

export const logout = async () => {
  if (isDevSession()) return
  await post<BaseResponse<null>>('/auth/logout')
}
