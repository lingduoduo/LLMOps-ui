import { type BasePaginatorResponse } from '@/models/base'

// Paginated custom API tool provider list response
export type GetApiToolProvidersWithPageResponse = BasePaginatorResponse<{
  id: string
  name: string
  icon: string
  description: string
  headers: Array<{ key: string; value: string }>
  tools: Array<{
    id: string
    name: string
    description: string
    inputs: Array<{ name: string; type: string; description: string; required: boolean }>
  }>
  created_at: number
}>

// Create custom API tool provider request
export type CreateApiToolProviderRequest = {
  name: string
  icon: string
  openapi_schema: string
  headers: Array<{ key: string; value: string }>
}

// Update custom API tool provider request
export type UpdateApiToolProviderRequest = {
  name: string
  icon: string
  openapi_schema: string
  headers: Array<{ key: string; value: string }>
}

// Custom API tool provider details
export type GetApiToolProviderResponse = {
  id: string
  name: string
  icon: string
  openapi_schema: string
  headers: Array<{ key: string; value: string }>
  created_at: number
}
