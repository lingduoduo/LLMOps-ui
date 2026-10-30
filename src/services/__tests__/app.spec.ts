import { afterEach, describe, expect, it, vi } from 'vitest'
import { debugApp } from '../app'

afterEach(() => vi.unstubAllGlobals())

function streamed(chunks: string[]) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
        controller.close()
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  )
}

describe('backend debug streaming', () => {
  it('posts to conversations and assembles SSE deltas across chunk boundaries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: RequestInit) => {
        expect(url).toBe('/api/apps/example%2Fapp/conversations')
        expect(JSON.parse(options.body as string)).toEqual({ query: 'Hello' })
        return streamed([
          'event: QueueEvent.AGENT_MESSAGE\r\nda',
          'ta:{"event":"agent_message","answer":"Hello "}\r\n\r',
          '\nevent: QueueEvent.AGENT_MESSAGE\ndata:{"event":"agent_message","answer":"world"}\n\nevent: QueueEvent.AGENT_END\ndata:{"event":"agent_end"}\n\n',
        ])
      }),
    )
    await expect(debugApp('example/app', 'Hello')).resolves.toMatchObject({
      data: { content: 'Hello world' },
    })
  })

  it('reports backend error events instead of completing a successful reply', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamed(['event: error\ndata:{"event":"error","observation":"Model offline"}\n\n']),
      ),
    )
    await expect(debugApp('example', 'Hello')).rejects.toThrow('Model offline')
  })

  it('reports an interrupted stream without an end event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamed(['event: agent_message\ndata:{"event":"agent_message","answer":"Partial"}\n\n']),
      ),
    )
    await expect(debugApp('example', 'Hello')).rejects.toThrow(/interrupted/i)
  })
})
