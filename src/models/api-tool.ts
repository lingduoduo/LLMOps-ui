import type { BasePaginatorResponse, BaseResponse } from './base'

export type ApiToolHeader = { key: string; value: string }
export type ApiTool = { name: string; description: string }
export type ApiToolProvider = {
  id: string
  name: string
  icon: string
  description: string
  headers: ApiToolHeader[]
  tools: ApiTool[]
  created_at: number
}

export type GetApiToolProvidersWithPageResponse = BasePaginatorResponse<ApiToolProvider>

export type CreateApiToolProviderRequest = {
  name: string
  icon: string
  openapi_schema: string
  headers: ApiToolHeader[]
}
export type UpdateApiToolProviderRequest = CreateApiToolProviderRequest
export type ApiToolProviderDetails = CreateApiToolProviderRequest & {
  id: string
  created_at: number
}
export type GetApiToolProviderResponse = BaseResponse<ApiToolProviderDetails>
