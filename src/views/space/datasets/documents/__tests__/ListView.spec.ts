import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import ArcoVue from '@arco-design/web-vue'
import ListView from '../ListView.vue'
import {
  deleteDocument,
  getDataset,
  getDatasetQueries,
  getDocument,
  getDocumentsWithPage,
  hit,
  updateDocumentEnabled,
  updateDocumentName,
} from '@/services/dataset'
import type { GetDocumentsWithPageResponse } from '@/models/dataset'

type DocumentItem = GetDocumentsWithPageResponse['data']['list'][number]

vi.mock('@/services/dataset', () => ({
  deleteDocument: vi.fn(),
  getDataset: vi.fn(),
  getDatasetQueries: vi.fn(),
  getDocument: vi.fn(),
  getDocumentsWithPage: vi.fn(),
  hit: vi.fn(),
  updateDocumentEnabled: vi.fn(),
  updateDocumentName: vi.fn(),
}))

const ok = <T>(data: T, message = '') => ({ code: 'success', message, data })
const doc = (id: string, overrides: Partial<DocumentItem> = {}): DocumentItem => ({
  id,
  name: `Document ${id}.md`,
  character_count: 12345,
  hit_count: 3,
  position: 1,
  enabled: true,
  disabled_at: 0,
  status: 'completed',
  error: '',
  updated_at: 1700000000,
  created_at: 1700000000,
  ...overrides,
})
const page = (list: DocumentItem[]) =>
  ok({
    list,
    paginator: { current_page: 1, total_page: 1, page_size: 20, total_record: list.length },
  })

let wrapper: VueWrapper | undefined
let router: Router
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })),
  )
  vi.mocked(getDataset).mockResolvedValue(
    ok({
      id: 'ds-1',
      icon: 'https://example.com/icon.png',
      name: 'Research',
      description: '',
      document_count: 2,
      hit_count: 5,
      related_app_count: 1,
      character_count: 100,
      updated_at: 1700000000,
      created_at: 1700000000,
    }),
  )
  vi.mocked(getDatasetQueries).mockResolvedValue(ok([]))
})
afterEach(() => {
  wrapper?.unmount()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const Stub = { template: '<div />' }
async function render(path = '/space/datasets/ds-1/documents') {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/space/datasets', name: 'space-datasets-list', component: Stub },
      {
        path: '/space/datasets/:dataset_id/documents',
        name: 'space-datasets-documents-list',
        component: ListView,
      },
      {
        path: '/space/datasets/:dataset_id/documents/create',
        name: 'space-datasets-documents-create',
        component: Stub,
      },
    ],
  })
  await router.push(path)
  wrapper = mount(ListView, {
    global: { plugins: [ArcoVue, router] },
    attachTo: document.body,
  })
  await settle()
  return wrapper
}
const body = () => document.body
const settle = async () => {
  for (let i = 0; i < 5; i++) await flushPromises()
}
const type = async (selector: string, value: string) => {
  const field = body().querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!
  field.value = value
  field.dispatchEvent(new Event('input'))
  await settle()
}
const button = (text: string, root: ParentNode = body()) =>
  [...root.querySelectorAll('button')].find((el) => el.textContent?.trim() === text)!
// Open the row's "more" dropdown and click one of its options.
const pickRowAction = async (text: string) => {
  body()
    .querySelector<HTMLButtonElement>(
      '.arco-table-td .arco-dropdown-open, .arco-table-td button.arco-btn-text',
    )!
    .click()
  await settle()
  const option = [...body().querySelectorAll<HTMLElement>('.arco-dropdown-option')].find((el) =>
    el.textContent?.includes(text),
  )!
  option.click()
  await settle()
}

describe('documents ListView', () => {
  it('shows the knowledge base header and the document rows', async () => {
    vi.mocked(getDocumentsWithPage).mockResolvedValue(
      page([doc('a'), doc('b', { enabled: false, status: 'error', error: 'Parse failed' })]),
    )
    await render()

    expect(getDataset).toHaveBeenCalledWith('ds-1')
    expect(getDocumentsWithPage).toHaveBeenCalledWith('ds-1', {
      current_page: 1,
      page_size: 20,
      search_word: '',
    })
    const text = body().textContent
    expect(text).toContain('Knowledge Base / Research')
    expect(text).toContain('2 documents')
    expect(text).toContain('5 hits')
    expect(text).toContain('1 linked apps')
    expect(text).toContain('Document a.md')
    expect(text).toContain('12.3k')
    expect(text).toContain('Available')
    expect(text).toContain('Disabled')
    expect(body().querySelector('a[href="/space/datasets/ds-1/documents/create"]')).not.toBeNull()
  })

  it('pushes the search word to the route and reloads from page 1', async () => {
    vi.mocked(getDocumentsWithPage).mockResolvedValue(page([doc('a')]))
    await render()

    await type('.arco-input-search input', 'guide')
    body().querySelector<HTMLElement>('.arco-input-search .arco-icon-hover')!.click()
    await settle()

    expect(router.currentRoute.value.query).toEqual({ search_word: 'guide', current_page: '1' })
    expect(getDocumentsWithPage).toHaveBeenLastCalledWith('ds-1', {
      current_page: '1',
      page_size: 20,
      search_word: 'guide',
    })
  })

  it('toggles a document and updates its status text', async () => {
    vi.mocked(getDocumentsWithPage).mockResolvedValue(page([doc('a')]))
    vi.mocked(updateDocumentEnabled).mockResolvedValue(ok({}, 'Updated'))
    await render()

    body().querySelector<HTMLButtonElement>('.arco-switch')!.click()
    await settle()

    expect(updateDocumentEnabled).toHaveBeenCalledWith('ds-1', 'a', false)
    expect(body().textContent).toContain('Disabled')
  })

  it('renames a document through the modal and reloads the list', async () => {
    vi.mocked(getDocumentsWithPage).mockResolvedValue(page([doc('a')]))
    vi.mocked(getDocument).mockResolvedValue(
      ok({ ...doc('a'), dataset_id: 'ds-1', segment_count: 1 }),
    )
    vi.mocked(updateDocumentName).mockResolvedValue(ok({}, 'Renamed'))
    await render()

    await pickRowAction('Rename')

    const input = body().querySelector<HTMLInputElement>('#document-name input')!
    expect(input.value).toBe('Document a.md')
    await type('#document-name input', 'Renamed.md')
    body().querySelector('.arco-modal form')!.dispatchEvent(new Event('submit'))
    await settle()

    expect(updateDocumentName).toHaveBeenCalledWith('ds-1', 'a', 'Renamed.md')
    expect(getDocumentsWithPage).toHaveBeenCalledTimes(2)
  })

  it('runs a retrieval test and lists the hit segments', async () => {
    vi.mocked(getDocumentsWithPage).mockResolvedValue(page([doc('a')]))
    vi.mocked(hit).mockResolvedValue(
      ok([
        {
          id: 'seg-1',
          document: { id: 'a', name: 'Document a.md', extension: 'md', mime_type: 'text/markdown' },
          dataset_id: 'ds-1',
          score: 0.91,
          position: 2,
          content: 'A matching segment.',
          keywords: [],
          character_count: 19,
          token_count: 4,
          hit_count: 1,
          enabled: true,
          disabled_at: 0,
          status: 'completed',
          error: '',
          updated_at: 1700000000,
          created_at: 1700000000,
        },
      ]),
    )
    await render()

    button('Retrieval Test').click()
    await settle()
    expect(getDatasetQueries).toHaveBeenCalledWith('ds-1')

    await type('#hit-query textarea, textarea#hit-query', 'how to')
    button('Test').click()
    await settle()

    expect(hit).toHaveBeenCalledWith('ds-1', {
      query: 'how to',
      retrieval_strategy: 'semantic',
      k: 4,
      score: 0.5,
    })
    expect(body().textContent).toContain('A matching segment.')
    expect(body().textContent).toContain('Score 0.91')
  })

  it('deletes a document after confirming and reloads the list and header', async () => {
    vi.mocked(getDocumentsWithPage).mockResolvedValue(page([doc('a')]))
    vi.mocked(deleteDocument).mockResolvedValue(ok({}, 'Deleted'))
    await render()

    await pickRowAction('Delete')
    // Modal.warning() ignores the app locale, so its OK button keeps Arco's default label.
    button('确定').click()
    await settle()

    expect(deleteDocument).toHaveBeenCalledWith('ds-1', 'a')
    expect(getDocumentsWithPage).toHaveBeenCalledTimes(2)
    expect(getDataset).toHaveBeenCalledTimes(2)
  })
})
