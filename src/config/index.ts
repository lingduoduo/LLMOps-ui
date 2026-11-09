// API request prefix: VITE_API_BASE_URL (default `/api`, proxied to the backend in development)
export const apiPrefix: string = (import.meta.env.VITE_API_BASE_URL?.trim() || '/api').replace(
  /\/+$/,
  '',
)

// Business status codes
export const httpCode = {
  success: 'success',
  fail: 'fail',
  notFound: 'not_found',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  validateError: 'validate_error',
}

// Display names for tool parameter types (the backend's ParameterType: str, int, float, bool)
export const typeMap: { [key: string]: string } = {
  str: 'String',
  int: 'Integer',
  float: 'Float',
  bool: 'Boolean',
}
