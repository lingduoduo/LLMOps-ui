// Basic response data format
export type BaseResponse<T> = {
  code: string // Response status code (e.g., success, fail)
  message: string // Description message for the response
  data: T // Generic data payload
}

// Basic paginated response data format
export type BasePaginatorResponse<T> = BaseResponse<{
  list: Array<T> // List of data items
  paginator: {
    // Pagination details
    total_page: number // Total number of pages
    total_record: number // Total number of records
    current_page: number // Current page number
    page_size: number // Number of items per page
  }
}>
