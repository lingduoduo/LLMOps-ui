import type { BuiltinApp, BuiltinAppCategory } from '@/models/builtin-app'
import type { BaseResponse } from '@/models/base'
import { get, post } from '@/utils/request'

export async function getBuiltinAppCategories(signal?: AbortSignal) {
  const { data } = await get<BaseResponse<BuiltinAppCategory[]>>('/builtin-apps/categories', {
    signal,
  })
  if (
    !Array.isArray(data) ||
    data.some((item) => !item || typeof item.category !== 'string' || typeof item.name !== 'string')
  )
    throw new Error('The server returned invalid app categories.')
  return data
}
export async function getBuiltinApps(signal?: AbortSignal) {
  const { data } = await get<BaseResponse<BuiltinApp[]>>('/builtin-apps', { signal })
  if (
    !Array.isArray(data) ||
    data.some(
      (item) =>
        !item ||
        typeof item.id !== 'string' ||
        typeof item.name !== 'string' ||
        typeof item.category !== 'string' ||
        typeof item.description !== 'string' ||
        typeof item.icon !== 'string' ||
        !item.model_config ||
        typeof item.model_config.provider !== 'string' ||
        typeof item.model_config.model !== 'string',
    )
  )
    throw new Error('The server returned an invalid app catalog.')
  return data
}
export async function addBuiltinAppToSpace(builtinAppId: string, signal?: AbortSignal) {
  const { data } = await post<BaseResponse<{ id: string }>>(
    '/builtin-apps/add-builtin-app-to-space',
    { body: { builtin_app_id: builtinAppId }, signal },
  )
  if (!data || typeof data.id !== 'string' || !data.id.trim())
    throw new Error('The server returned an invalid application ID.')
  return data
}
