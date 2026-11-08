import { get, post } from '@/utils/request'
import {
  type CreateApiToolProviderRequest,
  type GetApiToolProviderResponse,
  type GetApiToolProvidersWithPageResponse,
  type UpdateApiToolProviderRequest,
} from '@/models/api-tool'
import { type BaseResponse } from '@/models/base'

// Fetch a page of custom API tool providers.
export const getApiToolProvidersWithPage = (
  current_page: number = 1,
  page_size: number = 20,
  search_word: string = '',
) => {
  return get<GetApiToolProvidersWithPageResponse>('/api-tools', {
    params: { current_page, page_size, search_word },
  })
}

// Validate an OpenAPI schema.
export const validateOpenAPISchema = (openapi_schema: string) => {
  return post<BaseResponse<unknown>>('/api-tools/validate-openapi-schema', {
    body: { openapi_schema },
  })
}

// Create an API tool provider.
export const createApiToolProvider = (req: CreateApiToolProviderRequest) => {
  return post<BaseResponse<unknown>>('/api-tools', {
    body: req,
  })
}

// Update an API tool provider.
export const updateApiToolProvider = (provider_id: string, req: UpdateApiToolProviderRequest) => {
  return post<BaseResponse<unknown>>(`/api-tools/${encodeURIComponent(provider_id)}`, {
    body: req,
  })
}

// Delete an API tool provider.
export const deleteApiToolProvider = (provider_id: string) => {
  return post<BaseResponse<unknown>>(`/api-tools/${encodeURIComponent(provider_id)}/delete`)
}

// Fetch API tool provider details.
export const getApiToolProvider = (provider_id: string) => {
  return get<GetApiToolProviderResponse>(`/api-tools/${encodeURIComponent(provider_id)}`)
}
