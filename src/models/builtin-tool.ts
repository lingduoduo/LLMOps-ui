import { type BaseResponse } from '@/models/base'

// Built-in tool categories response
export type GetCategoriesResponse = BaseResponse<
  Array<{
    category: string
    icon: string
    name: string
  }>
>

// All built-in tool providers response
export type GetBuiltinToolsResponse = BaseResponse<
  Array<{
    background: string
    category: string
    created_at: number
    description: string
    label: string
    name: string
    tools: Array<{
      name: string
      label: string
      description: string
      inputs: Array<{ name: string; type: string; description: string; required: boolean }>
    }>
  }>
>
