import { type BaseResponse } from '@/models/base'

// Current account response
export type GetCurrentUserResponse = BaseResponse<{
  id: string
  name: string
  email: string
  avatar: string
}>
