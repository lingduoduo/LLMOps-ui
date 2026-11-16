import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ArcoVue, { Message } from '@arco-design/web-vue'
import CreateView from '../CreateView.vue'
import { uploadFile } from '@/services/upload-file'
import { createDocuments, getDocumentsStatus } from '@/services/dataset'
import type { GetDocumentsStatusResponse } from '@/models/dataset'

type DocumentStatus = GetDocumentsStatusResponse['data'][number]

vi.mock('@/services/upload-file', () => ({ uploadFile: vi.fn() }))
vi.mock('@/services/dataset', () => ({ createDocuments: vi.fn(), getDocumentsStatus: vi.fn() }))

const ok = <T>(data: T, message = '') => ({ code: 'success', message, data })
const status = (overrides: Partial<DocumentStatus> = {}): DocumentStatus => ({
  id: 'doc-1',
  name: 'notes.md',
  size: 2048,
  extension: 'md',
  mime_type: 'text/markdown',
  position: 1,
  segment_count: 4,
  completed_segment_count: 1,
  error: '',
  status: 'indexing',
  processing_started_at: 0,
  parsing_completed_at: 0,
  splitting_completed_at: 0,
  indexing_completed_at: 0,
  completed_at: 0,
  stopped_at: 0,
  created_at: 0,
  ...overrides,
})

let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })),
  )
  vi.mocked(uploadFile).mockResolvedValue(
    ok({
      id: 'file-1',
      account_id: 'me',
      name: 'notes.md',
      key: 'k',
      size: 2048,
      extension: 'md',
      mime_type: 'text/markdown',
      created_at: 0,
    }),
  )
  vi.mocked(createDocuments).mockResolvedValue(ok({ batch: 'batch-1', documents: [] }))
})
afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
  vi.resetAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const Stub = { template: '<div />' }
async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/space/datasets/:dataset_id/documents',
        name: 'space-datasets-documents-list',
        component: Stub,
      },
      {
        path: '/space/datasets/:dataset_id/documents/create',
        name: 'space-datasets-documents-create',
        component: CreateView,
      },
    ],
  })
  await router.push('/space/datasets/ds-1/documents/create')
  wrapper = mount(CreateView, { global: { plugins: [ArcoVue, router] }, attachTo: document.body })
  await settle()
  return wrapper
}
const body = () => document.body
const settle = async () => {
  for (let i = 0; i < 5; i++) await flushPromises()
}
const button = (text: string) =>
  [...body().querySelectorAll('button')].find((el) => el.textContent?.trim() === text)!
const click = async (text: string) => {
  button(text).click()
  await settle()
}
// Pick a file in the upload's hidden file input.
const pickFile = async (name = 'notes.md') => {
  const input = body().querySelector<HTMLInputElement>('input[type="file"]')!
  const file = new File(['# notes'], name, { type: 'text/markdown' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change'))
  await settle()
  return file
}

describe('add documents page', () => {
  it('needs an uploaded file before going to the segment settings', async () => {
    const error = vi.spyOn(Message, 'error').mockImplementation(() => ({ close: vi.fn() }))
    await render()

    await click('Next')
    expect(error).toHaveBeenCalledWith('Please upload the files to process')

    const file = await pickFile()
    expect(uploadFile).toHaveBeenCalledWith(file)
    await click('Next')
    expect(body().textContent).toContain('Automatic Segmentation and Cleaning')

    await click('Previous')
    expect(body().querySelector('input[type="file"]')).not.toBeNull()
  })

  it('creates the documents with the automatic rule and shows their progress', async () => {
    vi.mocked(getDocumentsStatus).mockResolvedValue(ok([status()]))
    await render()
    await pickFile()
    await click('Next')
    await click('Next')

    expect(createDocuments).toHaveBeenCalledWith('ds-1', {
      upload_file_ids: ['file-1'],
      process_type: 'automatic',
    })
    expect(getDocumentsStatus).toHaveBeenCalledWith('ds-1', 'batch-1')
    const text = body().textContent
    expect(text).toContain('The server is processing')
    expect(text).toContain('notes.md')
    expect(text).toContain('2.00kb')
    expect(text).toContain('25.00%')
    expect(body().querySelector('a[href="/space/datasets/ds-1/documents"] button')).not.toBeNull()
  })

  it('sends the custom rule with unescaped separators and the chosen preprocessing rules', async () => {
    vi.mocked(getDocumentsStatus).mockResolvedValue(ok([status({ status: 'completed' })]))
    await render()
    await pickFile()
    await click('Next')

    const custom = [...body().querySelectorAll<HTMLElement>('.font-bold')].find(
      (el) => el.textContent === 'Custom',
    )!
    custom.click()
    await settle()
    body().querySelector<HTMLInputElement>('input[value="remove_url_and_email"]')!.click()
    await settle()
    await click('Next')

    expect(createDocuments).toHaveBeenCalledWith('ds-1', {
      upload_file_ids: ['file-1'],
      process_type: 'custom',
      rule: {
        pre_process_rules: [
          { id: 'remove_extra_space', enabled: false },
          { id: 'remove_url_and_email', enabled: true },
        ],
        segment: { separators: ['\n'], chunk_size: 500, chunk_overlap: 50 },
      },
    })
    expect(body().textContent).toContain('Completed')
  })

  it('marks a failed upload and blocks the next step until it is removed', async () => {
    const error = vi.spyOn(Message, 'error').mockImplementation(() => ({ close: vi.fn() }))
    vi.mocked(uploadFile).mockRejectedValue(new Error('File size must not exceed 15 MB'))
    await render()

    await pickFile('big.pdf')
    expect(error).toHaveBeenCalledWith('big.pdf: File size must not exceed 15 MB')
    expect(body().querySelector('.arco-upload-list-item-error')).not.toBeNull()

    await click('Next')
    expect(error).toHaveBeenLastCalledWith(
      'Remove the files that failed to upload before continuing',
    )
    expect(createDocuments).not.toHaveBeenCalled()
  })

  it('accepts every document type the backend allows and shows the 15MB limit', async () => {
    await render()
    const accept = body().querySelector('input[type="file"]')!.getAttribute('accept')
    expect(accept).toBe('.doc,.docx,.pdf,.txt,.md,.markdown,.html,.htm,.xlsx,.xls,.csv')
    expect(body().textContent).toContain('each no larger than 15MB')
  })

  it('limits the chunk overlap to half the max segment length', async () => {
    vi.mocked(getDocumentsStatus).mockResolvedValue(ok([status({ status: 'completed' })]))
    await render()
    await pickFile()
    await click('Next')
    const custom = [...body().querySelectorAll<HTMLElement>('.font-bold')].find(
      (el) => el.textContent === 'Custom',
    )!
    custom.click()
    await settle()

    const [, overlap] = body().querySelectorAll<HTMLInputElement>('.arco-input-number input')
    expect(overlap.placeholder).toBe('Enter a number from 0 to 250')
    // Enter an overlap that fits, then lower the max segment length below twice the overlap:
    // the overlap is capped at the new maximum.
    const [sizeInput, overlapInput] = wrapper!.findAllComponents({ name: 'InputNumber' })
    overlapInput.vm.$emit('update:modelValue', 150)
    await settle()
    sizeInput.vm.$emit('update:modelValue', 200)
    await settle()
    expect(overlap.placeholder).toBe('Enter a number from 0 to 100')
    expect(overlap.value).toBe('100')
    await click('Next')

    expect(createDocuments).toHaveBeenCalledWith(
      'ds-1',
      expect.objectContaining({
        rule: expect.objectContaining({
          segment: { separators: ['\n'], chunk_size: 200, chunk_overlap: 100 },
        }),
      }),
    )
  })

  it('tells the user when polling stops before processing finishes', async () => {
    vi.mocked(getDocumentsStatus).mockResolvedValue(ok([status()]))
    await render()
    await pickFile()
    await click('Next')
    vi.useFakeTimers()
    await click('Next')
    expect(body().textContent).not.toContain('taking longer than expected')

    await vi.advanceTimersByTimeAsync(29 * 5000)
    expect(getDocumentsStatus).toHaveBeenCalledTimes(30)
    expect(body().textContent).toContain('Processing is taking longer than expected')

    await vi.advanceTimersByTimeAsync(5000)
    expect(getDocumentsStatus).toHaveBeenCalledTimes(30)
  })

  it('polls the status every 5 seconds until every document is done', async () => {
    vi.mocked(getDocumentsStatus)
      .mockResolvedValueOnce(ok([status()]))
      .mockResolvedValueOnce(ok([status({ status: 'error', error: 'Parse failed' })]))
    await render()
    await pickFile()
    await click('Next')
    vi.useFakeTimers()
    await click('Next')
    expect(getDocumentsStatus).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5000)
    expect(getDocumentsStatus).toHaveBeenCalledTimes(2)
    expect(body().textContent).toContain('Failed')

    await vi.advanceTimersByTimeAsync(15000)
    expect(getDocumentsStatus).toHaveBeenCalledTimes(2)
  })
})
