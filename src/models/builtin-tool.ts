import type { BaseResponse } from './base'

export type ToolInput = {
  name: string
  type: string
  description: string
  required: boolean
}

export type BuiltinTool = {
  name: string
  label: string
  description: string
  inputs: ToolInput[]
}

export type ToolCategory = { category: string; icon: string; name: string }

export type BuiltinToolProvider = {
  background: string
  category: string
  created_at: number
  description: string
  label: string
  name: string
  tools: BuiltinTool[]
}

export type GetCategoriesResponse = BaseResponse<ToolCategory[]>
export type GetBuiltinToolsResponse = BaseResponse<BuiltinToolProvider[]>
