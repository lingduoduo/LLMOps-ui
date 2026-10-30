import { post } from '@/utils/request'
import { setCredential, type Credential } from '@/utils/auth'
import type { BaseResponse } from '@/models/base'

export const passwordLogin = async (email: string, password: string) => {
  const response = await post<BaseResponse<Credential>>('/auth/password-login', {
    auth: false,
    body: { email, password },
  })
  setCredential(response.data)
}

export const logout = () => post<BaseResponse<null>>('/auth/logout')
