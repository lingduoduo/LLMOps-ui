import { type BaseResponse } from '@/models/base'

// Response structure for uploading a file
export type UploadFileResponse = BaseResponse<{
  id: string
  account_id: string
  name: string
  key: string
  size: number
  extension: string
  mime_type: string
  created_at: number
}>

// Response structure for uploading an image
export type UploadImageResponse = BaseResponse<{
  image_url: string
}>
