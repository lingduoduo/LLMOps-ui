import { get, post, stream } from '@/utils/request'
import type { DebugAppResponse, AppListResponse } from '@/models/app'
import type { BaseResponse } from '@/models/base'

export type DebugEvent = {
  event?: string
  answer?: string
  task_id?: string
  observation?: string
  thought?: string
}

export const debugApp = async (
  appId: string,
  query: string,
  signal?: AbortSignal,
  onEvent?: (event: string, data: DebugEvent) => void,
): Promise<DebugAppResponse> => {
  let content = ''
  let ended = false
  await stream(
    `/apps/${encodeURIComponent(appId)}/conversations`,
    { body: { query }, signal },
    ({ event, data }) => {
      if (!data || typeof data !== 'object')
        throw new Error('The server returned an invalid debug event.')
      const payload = data as DebugEvent
      // Python's str/Enum header can be QueueEvent.AGENT_MESSAGE; JSON uses the wire value.
      event = typeof payload.event === 'string' ? payload.event : event
      onEvent?.(event, payload)
      if (event === 'agent_message') {
        if (typeof payload.answer !== 'string')
          throw new Error('The server returned an invalid answer.')
        content += payload.answer
      }
      if (event === 'agent_end') ended = true
      if (event === 'error' || event === 'timeout' || event === 'stop') {
        throw new Error(
          payload.observation || payload.thought || `The debug request ended: ${event}.`,
        )
      }
    },
  )
  if (!ended) throw new Error('The response was interrupted. Please try again.')
  if (!content) throw new Error('The application returned no answer.')
  return { code: 'success', message: '', data: { content } }
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
