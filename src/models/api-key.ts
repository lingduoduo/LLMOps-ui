import { type BasePaginatorResponse } from '@/models/base'

// Paginated API key list response
export type GetApiKeysWithPageResponse = BasePaginatorResponse<{
  id: string
  api_key: string
  is_active: boolean
  remark: string
  updated_at: number
  created_at: number
}>

// Create or update API key request
export type SaveApiKeyRequest = {
  is_active: boolean
  remark: string
}
