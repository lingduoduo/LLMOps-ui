export type BuiltinAppCategory = { category: string; name: string }
export type BuiltinApp = {
  id: string
  category: string
  name: string
  icon: string
  description: string
  model_config: { provider: string; model: string }
  created_at: number
}
