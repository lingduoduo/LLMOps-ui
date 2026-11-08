import { get, post } from '@/utils/request'
import type { ApiKeyInput, ApiKeyListResponse } from '@/models/api-key'
import type { BaseResponse } from '@/models/base'
const path = '/openapi/api-keys'
export async function getApiKeys(page: number, signal?: AbortSignal) {
  const response = await get<ApiKeyListResponse>(path, {
    params: { current_page: page, page_size: 20 },
    signal,
  })
  if (!response.data || !Array.isArray(response.data.list) || !response.data.paginator)
    throw new Error('The server returned an invalid API key list.')
  return response.data
}
export const createApiKey = (body: ApiKeyInput, signal?: AbortSignal) =>
  post<BaseResponse<null>>(path, { body, signal })
export const updateApiKey = (id: string, body: ApiKeyInput, signal?: AbortSignal) =>
  post<BaseResponse<null>>(`${path}/${encodeURIComponent(id)}`, { body, signal })
export const toggleApiKey = (id: string, is_active: boolean, signal?: AbortSignal) =>
  post<BaseResponse<null>>(`${path}/${encodeURIComponent(id)}/is-active`, {
    body: { is_active },
    signal,
  })
export const deleteApiKey = (id: string, signal?: AbortSignal) =>
  post<BaseResponse<null>>(`${path}/${encodeURIComponent(id)}/delete`, { signal })
