// API request prefix
export const apiPrefix: string = (import.meta.env.VITE_API_BASE_URL?.trim() || '/api').replace(
  /\/+$/,
  '',
)

// Business logic response codes
export const httpCode = {
  success: 'success', // Request succeeded
  fail: 'fail', // Request failed
  notFound: 'not_found', // Resource not found
  unauthorized: 'unauthorized', // Unauthorized access
  forbidden: 'forbidden', // Forbidden action
  validateError: 'validate_error', // Validation error
}
