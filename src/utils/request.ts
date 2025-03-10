import { apiPrefix } from '@/config'

// 1. Timeout duration set to 100 seconds
const TIME_OUT = 100000

// 2. Basic fetch configuration
const baseFetchOptions = {
  method: 'GET',
  mode: 'cors', // Enables Cross-Origin Resource Sharing (CORS)
  credentials: 'include', // Ensures cookies are sent with requests
  headers: new Headers({
    'Content-Type': 'application/json',
  }),
  redirect: 'follow', // Follows HTTP redirects automatically
}

// 3. Type definition for fetch options
type FetchOptionType = Omit<RequestInit, 'body'> & {
  params?: Record<string, any> // Optional URL parameters
  body?: BodyInit | Record<string, any> | null // Request body
}

// 4. Base fetch request wrapper
const baseFetch = <T>(url: string, fetchOptions: FetchOptionType): Promise<T> => {
  // 5. Combine all configuration options
  const options: typeof baseFetchOptions & FetchOptionType = Object.assign(
    {},
    baseFetchOptions,
    fetchOptions,
  )

  // 6. Construct the URL with API prefix
  let urlWithPrefix = `${apiPrefix}${url.startsWith('/') ? url : `/${url}`}`

  // 7. Extract method, params, and body from options
  const { method, params, body } = options

  // 8. If the method is GET and params are provided
  if (method === 'GET' && params) {
    const paramsArray: string[] = []
    Object.keys(params).forEach((key) => {
      paramsArray.push(`${key}=${encodeURIComponent(params[key])}`)
    })
    if (urlWithPrefix.search(/\?/) === -1) {
      urlWithPrefix += `?${paramsArray.join('&')}`
    } else {
      urlWithPrefix += `&${paramsArray.join('&')}`
    }

    delete options.params
  }

  // 9. Handle POST request body
  if (body) {
    options.body = JSON.stringify(body)
  }

  // 10. Send two Promises in parallel (whichever returns first will resolve the final result)
  return Promise.race([
    // 11. Timeout handler
    new Promise((resolve, reject) => {
      setTimeout(() => {
        reject('Request timed out')
      }, TIME_OUT)
    }),
    // 12. Actual fetch request
    new Promise((resolve, reject) => {
      globalThis
        .fetch(urlWithPrefix, options as RequestInit)
        .then((res) => {
          resolve(res.json())
        })
        .catch((err) => {
          reject(err)
        })
    }),
  ]) as Promise<T>
}

// Utility functions for easier usage
export const request = <T>(url: string, options = {}) => {
  return baseFetch<T>(url, options)
}

export const get = <T>(url: string, options = {}) => {
  return request<T>(url, Object.assign({}, options, { method: 'GET' }))
}

export const post = <T>(url: string, options = {}) => {
  return request<T>(url, Object.assign({}, options, { method: 'POST' }))
}
