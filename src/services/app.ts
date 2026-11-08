import { get, post } from '@/utils/request'
import type { DebugAppResponse, AppListResponse } from '@/models/app'
import type { BaseResponse } from '@/models/base'

export const debugApp = (app_id: string, query: string, signal?: AbortSignal) => {
  return post<DebugAppResponse>(`/apps/${encodeURIComponent(app_id)}/debug`, {
    body: { query },
    signal,
  })
}

export const getApps = async (page: number, search: string, signal?: AbortSignal) => {
  const response = await get<AppListResponse>('/apps', {
    params: { current_page: page, page_size: 20, search_word: search },
    signal,
  })
  if (!response.data || !Array.isArray(response.data.list) || !response.data.paginator) {
    throw new Error('The server returned an invalid application list.')
  }
  return response.data
}

export const clearDebugConversation = (appId: string, signal?: AbortSignal) =>
  post<BaseResponse<null>>(
    `/apps/${encodeURIComponent(appId)}/conversations/delete-debug-conversation`,
    { signal },
  )

export const stopDebugChat = (appId: string, taskId: string) =>
  post<BaseResponse<null>>(
    `/apps/${encodeURIComponent(appId)}/conversations/tasks/${encodeURIComponent(taskId)}/stop`,
  )

export const createApp = async (
  body: import('@/models/app').CreateAppRequest,
  signal?: AbortSignal,
) => {
  const response = await post<BaseResponse<{ id: string }>>('/apps', { body, signal })
  if (!response.data || typeof response.data.id !== 'string' || !response.data.id) {
    throw new Error(
      'The server returned an invalid application ID. Check your applications before trying again.',
    )
  }
  return response.data
}
