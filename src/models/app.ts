import { type BaseResponse } from '@/models/base'

// Application preview and debugging API response
export type DebugAppResponse = BaseResponse<{
  content: string // Debug or preview content returned from the API
}>

export type AppSummary = {
  id: string
  name: string
  description: string
  status: string
}

export type AppListResponse = import('./base').BasePaginatorResponse<AppSummary>
