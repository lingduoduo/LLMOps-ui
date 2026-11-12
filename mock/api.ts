import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

// In-memory stand-in for the LLMOps backend, enabled only by `vite --mode mock`.
// Log in with any email and the password `password`. Tool marketplace and custom API tool
// endpoints are served from in-memory data. Special inputs trigger failures:
//   app search `error` -> HTTP 500 HTML page, `slow` -> 3s delay, `401` -> unauthorized
//   debug query containing `error` -> error event, `cut` -> stream ends without agent_end
// Knowledge bases (25 seeded, so the list pages) and image uploads are kept in memory too.

const MOCK_PASSWORD = 'password'
const revokedTokens = new Set<string>()
const stoppedTasks = new Set<string>()

const apps = Array.from({ length: 45 }, (_, index) => ({
  id: `app-${index + 1}`,
  name: `Mock App ${index + 1}`,
  description: `A fake application #${index + 1} served by the mock API.`,
  status: index % 3 === 0 ? 'draft' : 'published',
}))

// Built-in tool marketplace data, mirroring LLMOps-Flask-Service
// internal/core/tools/builtin_tools (categories.yaml, providers.yaml, each tool's YAML,
// and the inputs BuiltinToolService derives from the tool's args_schema).
const toolCategories = [
  { category: 'search', name: 'Search', icon: '' },
  { category: 'image', name: 'Image', icon: '' },
  { category: 'weather', name: 'Weather', icon: '' },
  { category: 'tool', name: 'Tool', icon: '' },
  { category: 'other', name: 'Other', icon: '' },
]
const queryInput = (description: string) => [
  { name: 'query', type: 'str', description, required: true },
]
const builtinProviders = [
  {
    name: 'google',
    label: 'Google',
    description: 'Google service provider, covering Google Search and other tools.',
    icon: 'icon.png',
    background: '#E5E7EB',
    category: 'search',
    created_at: 1722498386,
    tools: [
      {
        name: 'google_serper',
        label: 'Google Serper Search',
        description:
          'This is a low-cost Google Search API. Use this tool when you need to look up current events; the input is a query string.',
        params: [],
        inputs: queryInput('The query string to search for.'),
      },
    ],
  },
  {
    name: 'time',
    label: 'Time',
    description: 'A tool for obtaining the current time.',
    icon: 'icon.svg',
    background: '#E5E7EB',
    category: 'tool',
    created_at: 1722498386,
    tools: [
      {
        name: 'current_time',
        label: 'Current Time',
        description: 'A tool for retrieving the current time.',
        params: [],
        inputs: [],
      },
    ],
  },
  {
    name: 'duckduckgo',
    label: 'DuckDuckGo',
    description: 'A privacy-focused search engine.',
    icon: 'icon.svg',
    background: '#FFFFFF',
    category: 'search',
    created_at: 1722498386,
    tools: [
      {
        name: 'duckduckgo_search',
        label: 'DuckDuckGo Search',
        description: 'A privacy-focused search engine.',
        params: [],
        inputs: queryInput('The search query to execute'),
      },
    ],
  },
  {
    name: 'dalle',
    label: 'DALL·E',
    description: 'DALL·E is a text-to-image generation tool.',
    icon: 'icon.png',
    background: '#E5E7EB',
    category: 'image',
    created_at: 1722498386,
    tools: [
      {
        name: 'dalle3',
        label: 'DALLE-3 Drawing Tool',
        description: 'DALLE-3 is a text-to-image generation tool.',
        params: [
          {
            name: 'size',
            label: 'Image Size',
            type: 'select',
            default: '1024x1024',
            required: true,
            options: [
              { value: '1024x1024', label: '(Square) 1024×1024' },
              { value: '1792x1024', label: '(Landscape) 1792×1024' },
              { value: '1024x1792', label: '(Portrait) 1024×1792' },
            ],
          },
          {
            name: 'style',
            label: 'Image Style',
            type: 'select',
            default: 'vivid',
            required: true,
            options: [
              { value: 'vivid', label: 'Vivid' },
              { value: 'natural', label: 'Natural' },
            ],
          },
        ],
        inputs: queryInput('The input should be the text prompt for generating the image'),
      },
    ],
  },
  {
    name: 'wikipedia',
    label: 'Wikipedia',
    description:
      'Wikipedia is a free online encyclopedia created and edited by volunteers around the world.',
    icon: 'icon.svg',
    background: '#FFFFFF',
    category: 'other',
    created_at: 1722498386,
    tools: [
      {
        name: 'wikipedia_search',
        label: 'Wikipedia Search',
        description: 'A tool for performing Wikipedia searches and extracting snippets and pages.',
        params: [],
        inputs: queryInput('query to look up on wikipedia'),
      },
    ],
  },
]
// Icon files are copied from the backend's providers/<name>/_asset folders and served the
// way BuiltinToolService.get_provider_icon does; like the backend, the provider list itself
// leaves the icon field out.
const iconMimeTypes: Record<string, string> = { png: 'image/png', svg: 'image/svg+xml' }
const providerIcon = (name: string) => {
  const provider = builtinProviders.find((item) => item.name === name)
  if (!provider) return undefined
  return {
    body: readFileSync(new URL(`./assets/builtin-tools/${name}/${provider.icon}`, import.meta.url)),
    mimeType: iconMimeTypes[provider.icon.split('.').pop()!]!,
  }
}
const builtinProviderList = builtinProviders.map(({ icon: _icon, ...provider }) => provider)

// Custom API tools, extracted from the OpenAPI schema the way the backend does.
type ApiToolProvider = {
  id: string
  name: string
  icon: string
  description: string
  openapi_schema: string
  headers: { key: string; value: string }[]
  created_at: number
}
const parseSchema = (raw: unknown) => {
  try {
    const schema = JSON.parse(String(raw))
    if (!schema?.paths || typeof schema.paths !== 'object') return null
    const tools = Object.values(schema.paths as Record<string, Record<string, unknown>>).flatMap(
      (operations) =>
        Object.entries(operations ?? {}).flatMap(([method, op]) => {
          const operation = op as {
            operationId?: string
            description?: string
            parameters?: Array<Record<string, unknown>>
          } | null
          return ['get', 'post'].includes(method) && operation?.operationId
            ? [
                {
                  id: operation.operationId,
                  name: operation.operationId,
                  description: operation.description ?? '',
                  // Like GetApiToolProvidersWithPageResp: each parameter without its `in`.
                  inputs: (operation.parameters ?? []).map(({ in: _in, ...input }) => input),
                },
              ]
            : []
        }),
    )
    return { description: String(schema.description ?? schema.info?.description ?? ''), tools }
  } catch {
    return null
  }
}
// Same rules as the backend's CreateApiToolReq / UpdateApiToolProviderReq forms.
const validateApiToolBody = (body: Record<string, unknown>) => {
  const name = String(body.name ?? '').trim()
  const icon = String(body.icon ?? '').trim()
  if (!name) return 'Provider name cannot be empty'
  if (name.length > 30) return 'Provider name length must be between 1 and 30'
  if (!icon) return 'Provider icon cannot be empty'
  if (!/^https?:\/\/[^\s/]+\.[^\s]+$/.test(icon)) return 'Provider icon must be a valid URL'
  if (!parseSchema(body.openapi_schema)) return 'Invalid OpenAPI schema.'
  return null
}
const validationError = (res: ServerResponse, message: string) =>
  sendJson(res, 200, { code: 'validate_error', message, data: {} })

// Custom API tools taken from real backend data: the Youdao dictionary tool and the toolkit
// schema used by LLMOps-Flask-Service test/internal/handler/test_api_tool_handler.py.
const youdaoSchema = JSON.stringify({
  description: 'A tool for looking up English word definitions.',
  server: 'https://dict.youdao.com',
  paths: {
    '/suggest': {
      get: {
        description: 'Look up dictionary information for the given word.',
        operationId: 'YoudaoSuggest',
        parameters: [
          {
            name: 'q',
            in: 'query',
            description: 'The word to look up, e.g. love/computer',
            required: true,
            type: 'str',
          },
          {
            name: 'doctype',
            in: 'query',
            description: 'Response format, json or xml; json by default',
            required: false,
            type: 'str',
          },
        ],
      },
    },
  },
})
const toolkitSchema = JSON.stringify({
  description: 'Query IP location, weather forecast, route planning, etc. via a sample toolkit',
  server: 'https://tools.example.com',
  paths: {
    '/weather': {
      get: {
        description: 'Get weather forecast for a specified city, e.g., Guangzhou',
        operationId: 'GetCurrentWeather',
        parameters: [
          {
            name: 'location',
            in: 'query',
            description: 'City name to query weather for',
            required: true,
            type: 'str',
          },
        ],
      },
    },
    '/ip': {
      post: {
        description: 'Query IP location based on given IP',
        operationId: 'GetCurrentIp',
        parameters: [
          {
            name: 'ip',
            in: 'request_body',
            description: 'Standard IP address to query, e.g., 201.52.14.23',
            required: true,
            type: 'str',
          },
        ],
      },
    },
  },
})
const apiToolProviders: ApiToolProvider[] = [
  {
    id: 'a4b99b28-dcca-452d-b7ae-86f3188ca9c1',
    name: 'Youdao Dictionary',
    icon: 'https://shared.ydstatic.com/images/favicon.ico',
    description: 'A tool for looking up English word definitions.',
    openapi_schema: youdaoSchema,
    headers: [],
    created_at: Math.floor(new Date(2025, 0, 21, 7, 38).getTime() / 1000),
  },
  {
    id: 'a4b99b28-dcca-452d-b7ae-86f3188ca9cb',
    name: 'Google Search Toolkit',
    icon: 'https://www.google.com/favicon.ico',
    description: 'Query IP location, weather forecast, route planning, etc. via a sample toolkit',
    openapi_schema: toolkitSchema,
    headers: [{ key: 'Authorization', value: 'Bearer access_token' }],
    created_at: Math.floor(new Date(2025, 0, 21, 7, 35).getTime() / 1000),
  },
]
const apiToolSummary = (provider: ApiToolProvider) => {
  const { openapi_schema, ...summary } = provider
  return { ...summary, tools: parseSchema(openapi_schema)?.tools ?? [] }
}

// Knowledge base data, shaped like the LLMOps dataset API responses.
type Dataset = {
  id: string
  name: string
  icon: string
  description: string
  document_count: number
  hit_count: number
  character_count: number
  related_app_count: number
  updated_at: number
  created_at: number
}
const nowSeconds = () => Math.floor(Date.now() / 1000)
const datasets: Dataset[] = Array.from({ length: 25 }, (_, index) => ({
  id: `dataset-${index + 1}`,
  name: `Mock Knowledge Base ${index + 1}`,
  icon: '/api/builtin-tools/google/icon',
  description: `A fake knowledge base #${index + 1} served by the mock API, used to test the list, settings and delete actions.`,
  document_count: (index * 7) % 30,
  hit_count: index * 3,
  character_count: (index + 1) * 12345,
  related_app_count: index % 4,
  updated_at: nowSeconds() - index * 3600,
  created_at: nowSeconds() - index * 3600,
}))
const validateDatasetBody = (body: Record<string, unknown>) => {
  if (!String(body.name ?? '').trim()) return 'The knowledge base name cannot be empty.'
  if (String(body.name).trim().length > 100) return 'The knowledge base name is too long.'
  if (!String(body.icon ?? '').trim()) return 'The knowledge base icon cannot be empty.'
  return null
}

// Uploaded images, served back at /upload-files/images/:id.
const uploadedImages = new Map<string, { mimeType: string; body: Buffer }>()

// Pulls the first file part out of a multipart/form-data body.
const readMultipartFile = async (req: IncomingMessage) => {
  const boundary = req.headers['content-type']?.match(/boundary=(?:"([^"]+)"|([^;]+))/)
  if (!boundary) return null
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks)
  const delimiter = Buffer.from(`--${boundary[1] ?? boundary[2]}`)
  const start = raw.indexOf(delimiter)
  const headerEnd = raw.indexOf('\r\n\r\n', start)
  const end = raw.indexOf(delimiter, headerEnd)
  if (start === -1 || headerEnd === -1 || end === -1) return null
  const headers = raw.subarray(start, headerEnd).toString()
  return {
    mimeType:
      headers.match(/Content-Type:\s*([^\r\n]+)/i)?.[1].trim() ?? 'application/octet-stream',
    body: raw.subarray(headerEnd + 4, end - 2),
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const ok = (res: ServerResponse, data: unknown = null) =>
  sendJson(res, 200, { code: 'success', message: '', data })

const readBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || '{}')
  } catch {
    return {}
  }
}

// Any bearer token is accepted until logout revokes it.
const bearerToken = (req: IncomingMessage) => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
  return token && !revokedTokens.has(token) ? token : null
}

const unauthorized = (res: ServerResponse) =>
  sendJson(res, 401, { code: 'unauthorized', message: 'Please log in again.', data: {} })

const streamDebug = async (req: IncomingMessage, res: ServerResponse, query: string) => {
  const taskId = randomUUID()
  let closed = false
  res.on('close', () => {
    closed = true
  })
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  const send = (event: string, data: Record<string, unknown>) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify({ event, task_id: taskId, ...data })}\n\n`)

  send('agent_thought', { thought: 'Thinking about the question...' })
  await sleep(300)
  if (query.includes('error')) {
    send('error', { observation: 'The mock model failed on purpose.' })
    return res.end()
  }
  const words = `You asked: "${query}". This is a streamed mock answer, one word at a time.`.split(
    ' ',
  )
  for (const [index, word] of words.entries()) {
    if (closed) return
    if (stoppedTasks.delete(taskId)) {
      send('stop', { observation: 'The response was stopped.' })
      return res.end()
    }
    send('agent_message', { answer: index ? ` ${word}` : word })
    await sleep(120)
  }
  if (!query.includes('cut')) send('agent_end', {})
  res.end()
}

const handle = async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', 'http://mock')
  const route = `${req.method} ${url.pathname}`

  if (route === 'POST /auth/password-login') {
    const { email, password } = await readBody(req)
    if (!email || password !== MOCK_PASSWORD) {
      return sendJson(res, 200, { code: 'fail', message: 'Invalid email or password.', data: {} })
    }
    return ok(res, {
      access_token: randomUUID(),
      expire_at: Math.floor(Date.now() / 1000) + 60 * 60,
    })
  }

  // Icons load through <img> tags, which carry no bearer token, so they are public.
  const builtinIcon = url.pathname.match(/^\/builtin-tools\/([^/]+)\/icon$/)
  if (req.method === 'GET' && builtinIcon) {
    const name = decodeURIComponent(builtinIcon[1])
    const icon = providerIcon(name)
    if (!icon) {
      return sendJson(res, 404, {
        code: 'not_found',
        message: `Provider '${name}' not found`,
        data: {},
      })
    }
    res.setHeader('Content-Type', icon.mimeType)
    return res.end(icon.body)
  }
  const uploadedImage = url.pathname.match(/^\/upload-files\/images\/([^/]+)$/)
  if (req.method === 'GET' && uploadedImage) {
    const image = uploadedImages.get(decodeURIComponent(uploadedImage[1]))
    if (!image)
      return sendJson(res, 404, { code: 'not_found', message: 'Image not found.', data: {} })
    res.setHeader('Content-Type', image.mimeType)
    return res.end(image.body)
  }
  const token = bearerToken(req)
  if (!token) return unauthorized(res)

  if (route === 'POST /auth/logout') {
    revokedTokens.add(token)
    return ok(res)
  }
  if (route === 'GET /account') {
    return ok(res, { id: 'mock-user', name: 'Mock User', email: 'mock@localhost', avatar: '' })
  }
  if (route === 'GET /apps') {
    const search = url.searchParams.get('search_word') ?? ''
    if (search === 'error') {
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/html')
      return res.end('<h1>Internal Server Error</h1>')
    }
    if (search === 'slow') await sleep(3000)
    if (search === '401') return unauthorized(res)
    const page = Number(url.searchParams.get('current_page')) || 1
    const size = Number(url.searchParams.get('page_size')) || 20
    const matches = apps.filter((app) => app.name.toLowerCase().includes(search.toLowerCase()))
    return ok(res, {
      list: matches.slice((page - 1) * size, page * size),
      paginator: {
        total_page: Math.ceil(matches.length / size),
        total_record: matches.length,
        current_page: page,
        page_size: size,
      },
    })
  }

  if (req.method === 'POST' && /^\/apps\/[^/]+\/debug$/.test(url.pathname)) {
    const query = String((await readBody(req)).query ?? '')
    if (query.includes('error')) {
      return sendJson(res, 200, {
        code: 'fail',
        message: 'The mock model failed on purpose.',
        data: null,
      })
    }
    return ok(res, { content: `You asked: "${query}". This is a mock answer.` })
  }

  if (route === 'GET /builtin-tools/categories') return ok(res, toolCategories)
  if (route === 'GET /builtin-tools') return ok(res, builtinProviderList)

  if (route === 'GET /api-tools') {
    const search = (url.searchParams.get('search_word') ?? '').toLowerCase()
    const page = Number(url.searchParams.get('current_page')) || 1
    const size = Number(url.searchParams.get('page_size')) || 20
    const matches = apiToolProviders.filter((p) => p.name.toLowerCase().includes(search))
    return ok(res, {
      list: matches.slice((page - 1) * size, page * size).map(apiToolSummary),
      paginator: {
        total_page: Math.ceil(matches.length / size),
        total_record: matches.length,
        current_page: page,
        page_size: size,
      },
    })
  }
  if (route === 'POST /api-tools/validate-openapi-schema') {
    return parseSchema((await readBody(req)).openapi_schema)
      ? ok(res)
      : sendJson(res, 200, { code: 'validate_error', message: 'Invalid OpenAPI schema.', data: {} })
  }
  if (route === 'POST /api-tools') {
    const body = await readBody(req)
    const invalid = validateApiToolBody(body)
    if (invalid) return validationError(res, invalid)
    const parsed = parseSchema(body.openapi_schema)!
    apiToolProviders.unshift({
      id: randomUUID(),
      name: String(body.name).trim(),
      icon: String(body.icon).trim(),
      description: parsed.description,
      openapi_schema: String(body.openapi_schema),
      headers: (body.headers as ApiToolProvider['headers']) ?? [],
      created_at: Math.floor(Date.now() / 1000),
    })
    return sendJson(res, 200, { code: 'success', message: 'Tool created.', data: {} })
  }
  const apiTool = url.pathname.match(/^\/api-tools\/([^/]+?)(\/delete)?$/)
  if (apiTool) {
    const index = apiToolProviders.findIndex((p) => p.id === decodeURIComponent(apiTool[1]))
    if (index === -1) {
      return sendJson(res, 404, { code: 'not_found', message: 'Tool not found.', data: {} })
    }
    const provider = apiToolProviders[index]
    if (req.method === 'GET' && !apiTool[2]) return ok(res, provider)
    if (req.method === 'POST' && apiTool[2]) {
      apiToolProviders.splice(index, 1)
      return sendJson(res, 200, { code: 'success', message: 'Tool deleted.', data: {} })
    }
    if (req.method === 'POST') {
      const body = await readBody(req)
      const invalid = validateApiToolBody(body)
      if (invalid) return validationError(res, invalid)
      const parsed = parseSchema(body.openapi_schema)!
      Object.assign(provider, {
        name: String(body.name).trim(),
        icon: String(body.icon).trim(),
        description: parsed.description,
        openapi_schema: String(body.openapi_schema),
        headers: body.headers ?? [],
      })
      return sendJson(res, 200, { code: 'success', message: 'Tool updated.', data: {} })
    }
  }

  if (route === 'POST /upload-files/image') {
    const file = await readMultipartFile(req)
    if (!file || !file.mimeType.startsWith('image/')) {
      return validationError(res, 'Please upload a PNG or JPEG image.')
    }
    const id = randomUUID()
    uploadedImages.set(id, file)
    return ok(res, { image_url: `/api/upload-files/images/${id}` })
  }

  if (route === 'GET /datasets') {
    const search = (url.searchParams.get('search_word') ?? '').toLowerCase()
    const page = Number(url.searchParams.get('current_page')) || 1
    const size = Number(url.searchParams.get('page_size')) || 20
    const matches = datasets.filter((d) => d.name.toLowerCase().includes(search))
    return ok(res, {
      list: matches.slice((page - 1) * size, page * size),
      paginator: {
        total_page: Math.ceil(matches.length / size),
        total_record: matches.length,
        current_page: page,
        page_size: size,
      },
    })
  }
  if (route === 'POST /datasets') {
    const body = await readBody(req)
    const invalid = validateDatasetBody(body)
    if (invalid) return validationError(res, invalid)
    datasets.unshift({
      id: randomUUID(),
      name: String(body.name).trim(),
      icon: String(body.icon).trim(),
      description: String(body.description ?? '').trim(),
      document_count: 0,
      hit_count: 0,
      character_count: 0,
      related_app_count: 0,
      updated_at: nowSeconds(),
      created_at: nowSeconds(),
    })
    return sendJson(res, 200, { code: 'success', message: 'Knowledge base created.', data: {} })
  }
  const dataset = url.pathname.match(/^\/datasets\/([^/]+?)(\/delete)?$/)
  if (dataset) {
    const index = datasets.findIndex((d) => d.id === decodeURIComponent(dataset[1]))
    if (index === -1) {
      return sendJson(res, 404, {
        code: 'not_found',
        message: 'Knowledge base not found.',
        data: {},
      })
    }
    if (req.method === 'GET' && !dataset[2]) return ok(res, datasets[index])
    if (req.method === 'POST' && dataset[2]) {
      datasets.splice(index, 1)
      return sendJson(res, 200, { code: 'success', message: 'Knowledge base deleted.', data: {} })
    }
    if (req.method === 'POST') {
      const body = await readBody(req)
      const invalid = validateDatasetBody(body)
      if (invalid) return validationError(res, invalid)
      Object.assign(datasets[index], {
        name: String(body.name).trim(),
        icon: String(body.icon).trim(),
        description: String(body.description ?? '').trim(),
        updated_at: nowSeconds(),
      })
      return sendJson(res, 200, { code: 'success', message: 'Knowledge base updated.', data: {} })
    }
  }

  const conversation = url.pathname.match(/^\/apps\/([^/]+)\/conversations(\/.*)?$/)
  if (req.method === 'POST' && conversation) {
    const [, , action = ''] = conversation
    if (!action) return streamDebug(req, res, String((await readBody(req)).query ?? ''))
    if (action === '/delete-debug-conversation') return ok(res)
    const stop = action.match(/^\/tasks\/([^/]+)\/stop$/)
    if (stop) {
      stoppedTasks.add(decodeURIComponent(stop[1]))
      return ok(res)
    }
  }

  sendJson(res, 404, { code: 'not_found', message: `No mock for ${route}.`, data: {} })
}

export const mockApi = (): Plugin => ({
  name: 'llmops-mock-api',
  apply: (_config, { command, mode }) => command === 'serve' && mode === 'mock',
  configureServer(server) {
    // Registered before Vite's internal middlewares, so it answers ahead of the /api proxy.
    server.middlewares.use('/api', (req, res) => {
      handle(req, res).catch((error) =>
        sendJson(res, 500, { code: 'fail', message: String(error) }),
      )
    })
  },
})
