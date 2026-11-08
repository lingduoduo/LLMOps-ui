import type { BaseResponse } from '@/models/base'
import { post } from '@/utils/request'

export const updateAccountName = (name: string, signal?: AbortSignal) =>
  post<BaseResponse<unknown>>('/account/name', { body: { name }, signal })
export const updateAccountAvatar = (avatar: string, signal?: AbortSignal) =>
  post<BaseResponse<unknown>>('/account/avatar', { body: { avatar }, signal })
export const updateAccountPassword = (password: string, signal?: AbortSignal) =>
  post<BaseResponse<unknown>>('/account/password', { body: { password }, signal })
