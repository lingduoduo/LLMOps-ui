import { type BaseResponse } from '@/models/base'

// Application preview and debugging API response
export type DebugAppResponse = BaseResponse<{
  content: string // Debug or preview content returned from the API
}>
