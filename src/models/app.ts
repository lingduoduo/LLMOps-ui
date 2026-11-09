import { type BaseResponse, type BasePaginatorResponse } from '@/models/base'

// App preview and debug response
export type DebugAppResponse = BaseResponse<{
  content: string
}>

// Paginated app list response
export type GetAppsWithPageResponse = BasePaginatorResponse<{
  id: string
  name: string
  description: string
  status: string
}>

// Create app request
export type CreateAppRequest = {
  name: string
  icon: string
  description: string
}

// Create app response
export type CreateAppResponse = BaseResponse<{
  id: string
}>
