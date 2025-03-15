// API request prefix
export const apiPrefix: string = 'http://localhost:5000'

// Business logic response codes
export const httpCode = {
  success: 'success', // Request succeeded
  fail: 'fail', // Request failed
  notFound: 'not_found', // Resource not found
  unauthorized: 'unauthorized', // Unauthorized access
  forbidden: 'forbidden', // Forbidden action
  validateError: 'validate_error', // Validation error
}
