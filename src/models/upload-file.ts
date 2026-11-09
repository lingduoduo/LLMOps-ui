import { type BaseResponse } from '@/models/base'

// Upload image response
export type UploadImageResponse = BaseResponse<{
  image_url: string
}>
