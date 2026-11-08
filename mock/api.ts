import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

// In-memory stand-in for the LLMOps backend, enabled only by `vite --mode mock`.
// Log in with any email and the password `password`. Special inputs trigger failures:
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
