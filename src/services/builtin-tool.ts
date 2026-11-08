import { get } from '@/utils/request'
import type { GetBuiltinToolsResponse, GetCategoriesResponse } from '@/models/builtin-tool'

// Fetch built-in tool categories.
export const getCategories = (signal?: AbortSignal) => {
  return get<GetCategoriesResponse>('/builtin-tools/categories', { signal })
}

// Fetch all built-in tool providers.
export const getBuiltinTools = (signal?: AbortSignal) => {
  return get<GetBuiltinToolsResponse>('/builtin-tools', { signal })
}
