import { apiPrefix, httpCode } from '@/config'
import { clearCredential, getAccessToken } from '@/utils/auth'

const TIME_OUT = 100000

// Defaults for every request; per-request options override them.
const BASE_FETCH_OPTIONS: RequestInit = { credentials: 'include' }

type FetchOptionType = Omit<RequestInit, 'body'> & {
  auth?: boolean
  params?: Record<string, string | number | boolean | null | undefined>
  body?: BodyInit | Record<string, unknown> | null
}

export class RequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'RequestError'
  }
}

// Prefixes the API base and appends params before any fragment, skipping empty values.
const buildUrl = (url: string, params: FetchOptionType['params']) => {
  const requestUrl = `${apiPrefix}${url.startsWith('/') ? url : `/${url}`}`
  const search = new URLSearchParams()
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) search.append(key, String(value))
  })
  const query = search.toString()
  if (!query) return requestUrl
  const [path, fragment] = requestUrl.split('#', 2)
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}${query}${fragment === undefined ? '' : `#${fragment}`}`
}

// Plain objects are sent as JSON; FormData, Blob, strings, etc. pass through untouched.
const encodeBody = (body: FetchOptionType['body'], headers: Headers) => {
  if (!body || typeof body !== 'object') return body
  const prototype = Object.getPrototypeOf(body)
  if (prototype !== Object.prototype && prototype !== null) return body as BodyInit
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return JSON.stringify(body)
}

const fetchResponse = async <T>(
  url: string,
  options: FetchOptionType,
  consume: (response: Response) => Promise<T>,
): Promise<T> => {
  const { params, body, signal, auth = true, ...fetchOptions } = options
  const requestUrl = buildUrl(url, params)
  const headers = new Headers(fetchOptions.headers)
  const accessToken = auth ? getAccessToken() : null
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const requestBody = encodeBody(body, headers)

  const controller = new AbortController()
  const abort = () => controller.abort(signal?.reason)
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => {
    controller.abort(new RequestError('Request timed out. Please try again.'))
  }, TIME_OUT)

  try {
    const response = await globalThis.fetch(requestUrl, {
      ...BASE_FETCH_OPTIONS,
      ...fetchOptions,
      headers,
      body: requestBody,
      signal: controller.signal,
    })
    // Also discard responses from transports that complete despite cancellation.
    controller.signal.throwIfAborted()
    if (!response.ok) {
      let message = `Request failed (${response.status})`
      try {
        const error: unknown = await response.json()
        if (
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof error.message === 'string'
        ) {
          message = error.message || message
        }
      } catch {
        // Non-JSON error pages still produce a useful HTTP error.
      }
      throw new RequestError(
        message,
        response.status,
        response.status === 401 ? httpCode.unauthorized : undefined,
      )
    }
    return await consume(response)
  } catch (cause) {
    if (cause instanceof RequestError && cause.code === httpCode.unauthorized && auth) {
      const currentToken = getAccessToken()
      // A late failure must not invalidate a newly established session.
      if (!currentToken || currentToken === accessToken) clearCredential()
    }
    controller.signal.throwIfAborted()
    throw cause
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

const readJson = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) return undefined as T
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new RequestError('The server returned an invalid JSON response.', response.status)
  }
  if (data && typeof data === 'object' && 'code' in data && data.code !== httpCode.success) {
    const message =
      'message' in data && typeof data.message === 'string' && data.message
        ? data.message
        : 'The request failed.'
    throw new RequestError(message, response.status, String(data.code))
  }
  return data as T
}

export const request = <T>(url: string, options: FetchOptionType = {}): Promise<T> =>
  fetchResponse(url, options, readJson<T>)

export type StreamEvent = { event: string; data: unknown }

export const stream = (
  url: string,
  options: FetchOptionType,
  onEvent: (event: StreamEvent) => void,
) =>
  fetchResponse(url, { ...options, method: 'POST' }, async (response) => {
    if (!response.headers.get('Content-Type')?.includes('text/event-stream')) {
      await readJson(response)
      throw new RequestError('The server did not return a debug event stream.')
    }
    if (!response.body) throw new RequestError('The server returned an empty event stream.')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const dispatch = (block: string) => {
      let event = 'message'
      const data: string[] = []
      block.split('\n').forEach((line) => {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
      })
      if (!data.length) return
      let parsed: unknown
      try {
        parsed = JSON.parse(data.join('\n'))
      } catch {
        throw new RequestError('The server returned an invalid debug event.')
      }
      onEvent({ event, data: parsed })
    }
    let finished = false
    try {
      while (!finished) {
        const { value, done } = await reader.read()
        finished = done
        options.signal?.throwIfAborted()
        buffer += decoder.decode(value, { stream: !done })
        buffer = buffer.replace(/\r\n/g, '\n')
        let boundary: number
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          dispatch(buffer.slice(0, boundary))
          buffer = buffer.slice(boundary + 2)
        }
      }
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  })

export const get = <T>(url: string, options: FetchOptionType = {}) =>
  request<T>(url, { ...options, method: 'GET' })

export const post = <T>(url: string, options: FetchOptionType = {}) =>
  request<T>(url, { ...options, method: 'POST' })
