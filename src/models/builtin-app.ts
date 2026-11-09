import { type BaseResponse } from '@/models/base'

// Built-in app categories response
export type GetBuiltinAppCategoriesResponse = BaseResponse<
  Array<{
    category: string
    name: string
  }>
>

// All built-in apps response
export type GetBuiltinAppsResponse = BaseResponse<
  Array<{
    id: string
    category: string
    name: string
    icon: string
    description: string
    model_config: { provider: string; model: string }
    created_at: number
  }>
>

// Add built-in app to space response
export type AddBuiltinAppToSpaceResponse = BaseResponse<{
  id: string
}>
