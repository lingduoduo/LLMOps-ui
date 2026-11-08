import { type BaseResponse } from '@/models/base'

// Application preview and debug response.
export type DebugAppResponse = BaseResponse<{
  content: string
}>

export type AppSummary = {
  id: string
  name: string
  description: string
  status: string
}

export type AppListResponse = import('./base').BasePaginatorResponse<AppSummary>

export type CreateAppRequest = {
  name: string
  icon: string
  description: string
}
