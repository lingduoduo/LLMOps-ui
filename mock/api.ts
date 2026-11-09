import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

// In-memory stand-in for the LLMOps backend, enabled only by `vite --mode mock`.
// Log in with any email and the password `password`. Tool marketplace and custom API tool
// endpoints are served from in-memory data. Special inputs trigger failures:
//   app search `error` -> HTTP 500 HTML page, `slow` -> 3s delay, `401` -> unauthorized
//   debug query containing `error` -> error event, `cut` -> stream ends without agent_end

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

const weatherSchema = JSON.stringify({
  description: 'Look up the weather for a city.',
  server: 'https://weather.example.com',
  paths: {
    '/weather': {
      get: {
        description: 'Get the current weather for a city.',
        operationId: 'getWeather',
        parameters: [
          {
            name: 'city',
            in: 'query',
            description: 'City to look up, e.g. London',
            required: true,
            type: 'str',
          },
          {
            name: 'units',
            in: 'query',
            description: 'metric or imperial; defaults to metric',
            required: false,
            type: 'str',
          },
        ],
      },
    },
  },
})
const apiToolProviders: ApiToolProvider[] = Array.from({ length: 25 }, (_, index) => ({
  id: `api-tool-${index + 1}`,
  name: `Mock Weather ${index + 1}`,
  // The backend requires an icon URL; the samples default to picsum placeholders.
  icon: `https://picsum.photos/seed/weather-${index + 1}/80`,
  description: 'Look up the weather for a city.',
  openapi_schema: weatherSchema,
  headers: [],
  created_at: 1721460914 - index * 3600,
}))
const apiToolSummary = (provider: ApiToolProvider) => {
  const { openapi_schema, ...summary } = provider
  return { ...summary, tools: parseSchema(openapi_schema)?.tools ?? [] }
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
