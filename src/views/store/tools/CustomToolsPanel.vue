<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  createApiToolProvider,
  deleteApiToolProvider,
  getApiToolProvider,
  getApiToolProvidersWithPage,
  updateApiToolProvider,
  validateOpenAPISchema,
} from '@/services/api-tool'
import type { ApiToolHeader, ApiToolProvider } from '@/models/api-tool'

const providers = ref<ApiToolProvider[]>([])
const page = ref(1)
const totalPages = ref(0)
const search = ref('')
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const editorError = ref('')
const editing = ref(false)
const editingId = ref<string | null>(null)
const deleteId = ref<string | null>(null)
const form = reactive({ name: '', icon: '', openapi_schema: '', headers: '[]' })
let requestId = 0
let disposed = false
onBeforeUnmount(() => {
  disposed = true
  requestId++
})
const message = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'The request failed. Please try again.'

const load = async (requestedPage = 1) => {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const response = await getApiToolProvidersWithPage(requestedPage, 20, search.value.trim())
    if (id !== requestId || disposed) return
    providers.value = response.data.list
    page.value = response.data.paginator.current_page
    totalPages.value = response.data.paginator.total_page
  } catch (cause) {
    if (id === requestId && !disposed) error.value = message(cause)
  } finally {
    if (id === requestId && !disposed) loading.value = false
  }
}
onMounted(() => load())

const openCreate = () => {
  if (busy.value) return
  editingId.value = null
  editorError.value = ''
  Object.assign(form, { name: '', icon: '', openapi_schema: '', headers: '[]' })
  editing.value = true
}
defineExpose({ openCreate })
const openEdit = async (id: string) => {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const response = await getApiToolProvider(id)
    if (disposed) return
    editingId.value = id
    Object.assign(form, response.data, { headers: JSON.stringify(response.data.headers, null, 2) })
    editorError.value = ''
    editing.value = true
  } catch (cause) {
    if (!disposed) error.value = message(cause)
  } finally {
    busy.value = false
  }
}
const parseHeaders = (): ApiToolHeader[] => {
  const headers: unknown = JSON.parse(form.headers || '[]')
  if (
    !Array.isArray(headers) ||
    headers.some(
      (header: unknown) =>
        !header ||
        typeof header !== 'object' ||
        !('key' in header) ||
        typeof header.key !== 'string' ||
        !('value' in header) ||
        typeof header.value !== 'string',
    )
  )
    throw new Error('Headers must be a JSON array of objects with string key and value fields.')
  return headers as ApiToolHeader[]
}
const save = async () => {
  if (busy.value) return
  busy.value = true
  editorError.value = ''
  try {
    if (!form.name.trim() || !form.openapi_schema.trim())
      throw new Error('Enter a name and an OpenAPI schema.')
    const payload = {
      name: form.name.trim(),
      icon: form.icon.trim(),
      openapi_schema: form.openapi_schema.trim(),
      headers: parseHeaders(),
    }
    await validateOpenAPISchema(payload.openapi_schema)
    if (disposed) return
    if (editingId.value) await updateApiToolProvider(editingId.value, payload)
    else await createApiToolProvider(payload)
    if (disposed) return
    editing.value = false
    await load(1)
  } catch (cause) {
    if (!disposed) editorError.value = message(cause)
  } finally {
    busy.value = false
  }
}
const remove = async (id: string) => {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await deleteApiToolProvider(id)
    if (disposed) return
    deleteId.value = null
    if (editingId.value === id) editing.value = false
    await load(providers.value.length === 1 && page.value > 1 ? page.value - 1 : page.value)
  } catch (cause) {
    if (!disposed) error.value = message(cause)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section aria-label="Custom API tools" class="mt-8 border-t border-gray-200 pt-6">
    <div class="flex items-center justify-between gap-4 mb-4">
      <h2 class="text-lg font-semibold">Custom API Tools</h2>
      <button
        type="button"
        aria-label="Add custom tool"
        :disabled="busy"
        class="text-blue-700 underline"
        @click="openCreate"
      >
        Add custom tool
      </button>
    </div>
    <form aria-label="Search custom tools" class="flex gap-3 mb-4" @submit.prevent="load(1)">
      <input
        v-model="search"
        type="search"
        aria-label="Search custom tools"
        placeholder="Search custom tools"
        class="border rounded px-3 py-2 flex-1 min-w-0"
      />
      <button type="submit" :disabled="loading" class="border rounded px-4 py-2">Search</button>
    </form>
    <p v-if="loading" role="status">Loading custom tools…</p>
    <p v-if="error" role="alert" class="text-red-700 mb-4">
      {{ error }} <button type="button" class="underline" @click="load(page)">Retry</button>
    </p>
    <p v-if="!loading && !error && !providers.length" class="text-gray-500 mb-4">
      No custom tools found.
    </p>
    <ul v-if="!error" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="provider in providers"
        :key="provider.id"
        class="border border-gray-200 rounded-lg p-4"
      >
        <h3 class="font-semibold">{{ provider.name }}</h3>
        <p class="text-sm text-gray-500 mb-3">{{ provider.description }}</p>
        <div class="flex gap-4">
          <button
            type="button"
            :disabled="busy"
            class="text-blue-700 underline"
            @click="openEdit(provider.id)"
          >
            Edit {{ provider.name }}
          </button>
          <button
            type="button"
            :disabled="busy"
            class="text-red-700 underline"
            @click="deleteId = provider.id"
          >
            Delete
          </button>
        </div>
        <div v-if="deleteId === provider.id" class="mt-3">
          <p>Delete {{ provider.name }}?</p>
          <button
            type="button"
            :disabled="busy"
            class="text-red-700 underline mr-4"
            @click="remove(provider.id)"
          >
            Confirm delete
          </button>
          <button type="button" :disabled="busy" class="underline" @click="deleteId = null">
            Cancel
          </button>
        </div>
      </li>
    </ul>
    <div v-if="totalPages > 1" class="flex items-center gap-4 mt-4">
      <button
        type="button"
        :disabled="loading || page <= 1"
        class="underline"
        @click="load(page - 1)"
      >
        Previous
      </button>
      <span>Page {{ page }} of {{ totalPages }}</span>
      <button
        type="button"
        :disabled="loading || page >= totalPages"
        class="underline"
        @click="load(page + 1)"
      >
        Next
      </button>
    </div>
    <form
      v-if="editing"
      aria-label="Custom tool editor"
      class="mt-6 border rounded-lg p-4 flex flex-col gap-4"
      @submit.prevent="save"
    >
      <h3 class="font-semibold">{{ editingId ? 'Edit Custom Tool' : 'Create Custom Tool' }}</h3>
      <fieldset :disabled="busy" class="flex flex-col gap-4">
        <label class="flex flex-col gap-1"
          >Name<input
            v-model="form.name"
            aria-label="Tool name"
            required
            class="border rounded px-3 py-2"
        /></label>
        <label class="flex flex-col gap-1"
          >Icon URL<input
            v-model="form.icon"
            aria-label="Icon URL"
            type="url"
            class="border rounded px-3 py-2"
        /></label>
        <label class="flex flex-col gap-1"
          >OpenAPI schema<textarea
            v-model="form.openapi_schema"
            aria-label="OpenAPI schema"
            required
            rows="8"
            class="border rounded px-3 py-2 font-mono text-sm"
          />
        </label>
        <label class="flex flex-col gap-1"
          >Request headers (JSON)<textarea
            v-model="form.headers"
            aria-label="Request headers"
            rows="3"
            class="border rounded px-3 py-2 font-mono text-sm"
          />
        </label>
        <p class="text-sm text-gray-500">
          Use an array of objects with "key" and "value" fields. Leave [] for no headers.
        </p>
        <p v-if="editorError" role="alert" class="text-red-700">{{ editorError }}</p>
        <div class="flex gap-4">
          <button type="submit" class="rounded bg-blue-700 text-white px-4 py-2">Save tool</button>
          <button type="button" class="underline" @click="editing = false">Cancel</button>
        </div>
      </fieldset>
      <p v-if="busy" role="status">Saving tool…</p>
    </form>
  </section>
</template>
