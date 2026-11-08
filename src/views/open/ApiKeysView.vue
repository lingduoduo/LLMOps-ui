<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { getAccessToken } from '@/utils/auth'
import type { ApiKey } from '@/models/api-key'
import {
  getApiKeys,
  createApiKey,
  updateApiKey,
  toggleApiKey,
  deleteApiKey,
} from '@/services/api-key'
const keys = ref<ApiKey[]>([])
const page = ref(1),
  totalPages = ref(1),
  total = ref(0)
const loading = ref(false),
  busy = ref(false),
  error = ref(''),
  notice = ref('')
const revealed = ref(new Set<string>())
const editing = ref<ApiKey | null>(null),
  formOpen = ref(false),
  remark = ref(''),
  active = ref(true)
const deleting = ref<ApiKey | null>(null)
let alive = true,
  generation = 0
let readController: AbortController | undefined
let writeController: AbortController | undefined
async function load(target = page.value) {
  const version = ++generation
  const session = getAccessToken()
  readController?.abort()
  readController = new AbortController()
  loading.value = true
  error.value = ''
  revealed.value = new Set()
  keys.value = []
  try {
    const data = await getApiKeys(target, readController.signal)
    if (!alive || version !== generation || session !== getAccessToken()) return
    if (data.list.length === 0 && target > 1) {
      await load(target - 1)
      return
    }
    keys.value = data.list
    page.value = target
    totalPages.value = data.paginator.total_page
    total.value = data.paginator.total_record
  } catch (cause) {
    if (alive && version === generation && session === getAccessToken())
      error.value = cause instanceof Error ? cause.message : 'Could not load API keys.'
  } finally {
    if (alive && version === generation) loading.value = false
  }
}
function openForm(key: ApiKey | null = null) {
  editing.value = key
  remark.value = key?.remark ?? ''
  active.value = key?.is_active ?? true
  formOpen.value = true
  error.value = ''
}
async function write(
  action: (signal: AbortSignal) => Promise<unknown>,
  success: string,
  targetPage = page.value,
) {
  if (busy.value) return
  const session = getAccessToken()
  busy.value = true
  error.value = ''
  notice.value = ''
  writeController = new AbortController()
  // A read begun before a mutation must never overwrite its result.
  ++generation
  readController?.abort()
  loading.value = false
  try {
    await action(writeController.signal)
    if (!alive || session !== getAccessToken()) {
      keys.value = []
      revealed.value = new Set()
      return
    }
    formOpen.value = false
    deleting.value = null
    notice.value = success
    await load(targetPage)
  } catch (cause) {
    if (alive && session === getAccessToken())
      error.value = cause instanceof Error ? cause.message : 'The change could not be saved.'
  } finally {
    if (alive) busy.value = false
  }
}
function save() {
  if (remark.value.length > 100) {
    error.value = 'Remarks must be 100 characters or fewer.'
    return
  }
  const input = { remark: remark.value.trim(), is_active: active.value }
  const id = editing.value?.id
  void write(
    (signal) => (id ? updateApiKey(id, input, signal) : createApiKey(input, signal)),
    id ? 'API key updated.' : 'API key created. Reveal it below when needed.',
    id ? page.value : 1,
  )
}
const deleteDialog = ref<HTMLElement | null>(null)
let deleteTrigger: HTMLElement | null = null
function closeDelete() {
  if (busy.value) return
  deleting.value = null
  void nextTick(() => deleteTrigger?.focus())
}
function dialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeDelete()
    return
  }
  if (event.key !== 'Tab') return
  const buttons = Array.from(
    deleteDialog.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
  )
  event.preventDefault()
  if (!buttons.length) {
    deleteDialog.value?.focus()
    return
  }
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const index = (current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
  buttons[index]?.focus()
}
function confirmDelete(key: ApiKey) {
  deleteTrigger = document.activeElement as HTMLElement
  deleting.value = key
  error.value = ''
  void nextTick(() =>
    deleteDialog.value?.querySelector<HTMLButtonElement>('[data-cancel-delete]')?.focus(),
  )
}
function removeKey() {
  const id = deleting.value?.id
  if (id) void write((signal) => deleteApiKey(id, signal), 'API key deleted.')
}
function reveal(id: string) {
  const next = new Set(revealed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  revealed.value = next
}
onMounted(() => void load())
onBeforeUnmount(() => {
  alive = false
  ++generation
  readController?.abort()
  writeController?.abort()
  keys.value = []
  revealed.value.clear()
})
</script>

<template>
  <main class="mx-auto w-full max-w-6xl p-5 md:p-8">
    <header class="mb-7 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-sm text-gray-500">Developer access</p>
        <h1 class="text-2xl font-semibold text-gray-900">Open API</h1>
        <p class="mt-2 text-sm text-gray-600">Manage API keys for your published applications.</p>
      </div>
      <div class="flex gap-3">
        <button
          data-testid="refresh"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
          :disabled="busy"
          @click="load()"
        >
          Refresh</button
        ><button
          data-testid="create"
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          :disabled="busy"
          @click="openForm()"
        >
          Create API key
        </button>
      </div>
    </header>
    <p v-if="error" role="alert" class="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
      {{ error }}
      <button v-if="!formOpen && !deleting" class="ml-2 underline" :disabled="busy" @click="load()">
        Retry
      </button>
    </p>
    <p v-if="notice" role="status" class="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-800">
      {{ notice }}
    </p>
    <form
      v-if="formOpen"
      class="mb-6 rounded-xl border border-gray-200 bg-white p-5"
      @submit.prevent="save"
    >
      <h2 class="mb-4 font-semibold">{{ editing ? 'Edit API key' : 'Create API key' }}</h2>
      <label class="block text-sm"
        >Remark<input
          v-model="remark"
          name="remark"
          maxlength="100"
          class="mt-2 block w-full rounded-lg border border-gray-300 p-2"
          :disabled="busy"
          placeholder="For example, production integration"
      /></label>
      <label class="my-4 flex items-center gap-2 text-sm"
        ><input v-model="active" type="checkbox" :disabled="busy" /> Active</label
      >
      <div class="flex gap-3">
        <button
          type="submit"
          :disabled="busy"
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {{ busy ? 'Saving…' : 'Save API key' }}</button
        ><button
          type="button"
          :disabled="busy"
          class="rounded-lg border px-4 py-2 text-sm"
          @click="formOpen = false"
        >
          Cancel
        </button>
      </div>
    </form>
    <section
      aria-label="API keys"
      class="overflow-hidden rounded-xl border border-gray-200 bg-white"
    >
      <p v-if="loading" role="status" class="p-8 text-center text-gray-500">Loading API keys…</p>
      <p v-else-if="!keys.length && !error" class="p-10 text-center text-gray-500">
        No API keys yet. Create a key to connect your application.
      </p>
      <ul v-else class="divide-y divide-gray-100">
        <li
          v-for="key in keys"
          :key="key.id"
          class="flex flex-wrap items-center justify-between gap-5 p-5"
        >
          <div class="min-w-0">
            <p class="font-medium text-gray-900">
              {{ key.remark || 'Untitled key' }}
              <span
                class="ml-2 rounded-full px-2 py-1 text-xs"
                :class="key.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'"
                >{{ key.is_active ? 'Active' : 'Inactive' }}</span
              >
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <code class="break-all text-sm text-gray-600">{{
                revealed.has(key.id) ? key.api_key : '••••••••••••••••••••••••'
              }}</code
              ><button
                class="text-sm text-blue-600"
                :aria-label="`${revealed.has(key.id) ? 'Hide' : 'Reveal'} key for ${key.remark || 'Untitled key'}`"
                @click="reveal(key.id)"
              >
                {{ revealed.has(key.id) ? 'Hide' : 'Reveal' }}
              </button>
            </div>
          </div>
          <div class="flex flex-wrap gap-4 text-sm">
            <button
              :disabled="busy"
              class="text-gray-600 disabled:opacity-50"
              @click="openForm(key)"
            >
              Edit</button
            ><button
              :disabled="busy"
              class="text-blue-600 disabled:opacity-50"
              @click="
                write(
                  (signal) => toggleApiKey(key.id, !key.is_active, signal),
                  'API key status updated.',
                )
              "
            >
              {{ key.is_active ? 'Deactivate' : 'Activate' }}</button
            ><button
              :disabled="busy"
              class="text-red-600 disabled:opacity-50"
              @click="confirmDelete(key)"
            >
              Delete
            </button>
          </div>
        </li>
      </ul>
      <div
        class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 p-4 text-sm text-gray-500"
      >
        <span>{{ total }} keys · Page {{ page }} of {{ Math.max(1, totalPages) }}</span>
        <div class="flex gap-4">
          <button
            :disabled="loading || busy || page <= 1"
            class="disabled:opacity-40"
            @click="load(page - 1)"
          >
            Previous</button
          ><button
            :disabled="loading || busy || page >= totalPages"
            class="disabled:opacity-40"
            @click="load(page + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </section>
    <section
      v-if="deleting"
      ref="deleteDialog"
      tabindex="-1"
      @keydown="dialogKeydown"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-key-title"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-5"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-6">
        <h2 id="delete-key-title" class="text-lg font-semibold">Delete API key?</h2>
        <p class="my-4 text-sm text-gray-600">
          Integrations using {{ deleting.remark || 'this key' }} will lose access. This cannot be
          undone.
        </p>
        <p v-if="error" role="alert" class="mb-4 text-sm text-red-600">{{ error }}</p>
        <div class="flex gap-3">
          <button
            :disabled="busy"
            class="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50"
            @click="removeKey"
          >
            {{ busy ? 'Deleting…' : 'Delete key' }}</button
          ><button
            data-cancel-delete
            :disabled="busy"
            class="rounded-lg border px-4 py-2"
            @click="closeDelete"
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
    <section class="mt-8 rounded-xl bg-gray-50 p-6">
      <h2 class="font-semibold text-gray-900">Use the Open API</h2>
      <p class="my-3 text-sm text-gray-600">
        Publish your application first, then send a POST request to <code>/openapi/chat</code> on
        your API server. Keep API keys on your server and send your key in the Authorization header.
      </p>
      <pre class="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs leading-6 text-gray-100">
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{ "app_id": "YOUR_PUBLISHED_APP_ID", "query": "Hello", "stream": false }</pre>
    </section>
  </main>
</template>
