import { get } from '@/utils/request'
import type { GetBuiltinToolsResponse, GetCategoriesResponse } from '@/models/builtin-tool'

export const getCategories = async (signal?: AbortSignal) => {
  const response = await get<GetCategoriesResponse>('/builtin-tools/categories', { signal })
  if (!Array.isArray(response.data)) throw new Error('The server returned invalid tool categories.')
  return response
}

export const getBuiltinTools = async (signal?: AbortSignal) => {
  const response = await get<GetBuiltinToolsResponse>('/builtin-tools', { signal })
  if (
    !Array.isArray(response.data) ||
    response.data.some(
      (provider) =>
        !provider || typeof provider.name !== 'string' || !Array.isArray(provider.tools),
    )
  )
    throw new Error('The server returned an invalid tool provider list.')
  return response
}
