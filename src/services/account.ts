/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BaseResponse } from '@/models/base'
import { post } from '@/utils/request'

export const updateAccountName = (name: string, signal?: AbortSignal) =>
  post<BaseResponse<any>>('/account/name', { body: { name }, signal })
export const updateAccountAvatar = (avatar: string, signal?: AbortSignal) =>
  post<BaseResponse<any>>('/account/avatar', { body: { avatar }, signal })
export const updateAccountPassword = (password: string, signal?: AbortSignal) =>
  post<BaseResponse<any>>('/account/password', { body: { password }, signal })
