import type { BasePaginatorResponse } from './base'
export type ApiKey = {
  id: string
  api_key: string
  is_active: boolean
  remark: string
  updated_at: number
  created_at: number
}
export type ApiKeyInput = Pick<ApiKey, 'is_active' | 'remark'>
export type ApiKeyListResponse = BasePaginatorResponse<ApiKey>
