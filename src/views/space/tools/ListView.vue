<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import {
  createApiToolProvider,
  deleteApiToolProvider,
  getApiToolProvider,
  getApiToolProvidersWithPage,
  updateApiToolProvider,
  validateOpenAPISchema,
} from '@/services/api-tool'
import type { ApiToolHeader, ApiToolProvider } from '@/models/api-tool'
import moment from 'moment'
import ToolList from '@/components/ToolList.vue'
import { useAccountStore } from '@/stores/account'

const PAGE_SIZE = 20
const route = useRoute()
const router = useRouter()
const accountStore = useAccountStore()

// Provider list, loaded page by page as the user scrolls.
const providers = ref<ApiToolProvider[]>([])
const page = ref(0)
const totalPages = ref(0)
const loading = ref(false)
const listError = ref('')
const hasMore = computed(() => page.value < totalPages.value)
const selectedProvider = ref<ApiToolProvider | null>(null)

// Create/edit dialog state.
const editorOpen = ref(false)
const editingId = ref<string | null>(null)
const editorError = ref('')
const schemaError = ref('')
const loadingDetails = ref(false)
const saving = ref(false)
const confirmingDelete = ref(false)
const form = reactive({ icon: '', name: '', openapi_schema: '', headers: [] as ApiToolHeader[] })

let requestId = 0
// Sentinel below the grid; scrolling it into view loads the next page.
const sentinel = ref<HTMLElement>()
let observer: IntersectionObserver | undefined
let disposed = false
const message = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'The request failed. Please try again.'
const searchWord = () =>
  typeof route.query.search_word === 'string' ? route.query.search_word.trim() : ''

// Load the next page, or the first page again when `reset` is true.
const loadPage = async (reset = false) => {
  if (!reset && (loading.value || !hasMore.value)) return
  const id = ++requestId
  loading.value = true
  listError.value = ''
  try {
    const response = await getApiToolProvidersWithPage(
      reset ? 1 : page.value + 1,
      PAGE_SIZE,
      searchWord(),
    )
    if (id !== requestId || disposed) return
    const { list, paginator } = response.data
    providers.value = reset ? list : [...providers.value, ...list]
    page.value = paginator.current_page
    totalPages.value = paginator.total_page
    // Re-observe so a sentinel that is still on screen (page shorter than the viewport)
    // triggers the next page instead of waiting for a scroll that can never happen.
    if (observer && sentinel.value) {
      observer.unobserve(sentinel.value)
      observer.observe(sentinel.value)
    }
  } catch (cause) {
    if (id === requestId && !disposed) listError.value = message(cause)
  } finally {
    if (id === requestId && !disposed) loading.value = false
  }
}
const reload = () => {
  selectedProvider.value = null
  return loadPage(true)
}

// Fetch the next page when the sentinel below the grid scrolls into view.
const canObserve = typeof IntersectionObserver !== 'undefined'
onMounted(() => {
  void reload()
  if (canObserve && sentinel.value) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadPage()
    })
    observer.observe(sentinel.value)
  }
})
onBeforeUnmount(() => {
  disposed = true
  requestId++
  observer?.disconnect()
})
watch(() => route.query.search_word, reload)

// Tools the backend will extract from the schema: GET/POST operations with an
// operationId and a description.
const schemaTools = computed(() => {
  try {
    const schema: unknown = JSON.parse(form.openapi_schema)
    const paths = (schema as { paths?: unknown })?.paths
    if (!paths || typeof paths !== 'object') return []
    return Object.entries(paths as Record<string, Record<string, unknown>>).flatMap(
      ([path, operations]) =>
        Object.entries(operations ?? {}).flatMap(([method, operation]) => {
          const op = operation as { operationId?: unknown; description?: unknown } | null
          return ['get', 'post'].includes(method) &&
            typeof op?.operationId === 'string' &&
            typeof op.description === 'string'
            ? [{ name: op.operationId, description: op.description, method, path }]
            : []
        }),
    )
  } catch {
    return []
  }
})

const resetForm = (values?: Partial<typeof form>) => {
  Object.assign(form, { icon: '', name: '', openapi_schema: '', headers: [] }, values)
  editorError.value = ''
  schemaError.value = ''
  confirmingDelete.value = false
}
const openCreate = () => {
  editingId.value = null
  resetForm()
  editorOpen.value = true
}
const openEdit = async () => {
  if (!selectedProvider.value || loadingDetails.value) return
  const id = selectedProvider.value.id
  loadingDetails.value = true
  try {
    const { data } = await getApiToolProvider(id)
    if (disposed) return
    editingId.value = id
    resetForm({
      icon: data.icon,
      name: data.name,
      openapi_schema: data.openapi_schema,
      headers: data.headers.map((header) => ({ ...header })),
    })
    editorOpen.value = true
  } catch (cause) {
    if (!disposed) Message.error(message(cause))
  } finally {
    loadingDetails.value = false
  }
}
const closeEditor = () => {
  if (saving.value) return
  editorOpen.value = false
  if (route.query.create) {
    const query = { ...route.query }
    delete query.create
    void router.replace({ query })
  }
}
// Personal Space and the tool marketplace ask for the create dialog through `?create=tool`.
watch(
  () => route.query.create,
  (create) => {
    if (create === 'tool' && !editorOpen.value) openCreate()
  },
  { immediate: true },
)

const validateSchema = async () => {
  schemaError.value = ''
  const schema = form.openapi_schema.trim()
  if (!schema) return
  try {
    await validateOpenAPISchema(schema)
  } catch (cause) {
    if (!disposed && form.openapi_schema.trim() === schema) schemaError.value = message(cause)
  }
}
const save = async () => {
  if (saving.value) return
  editorError.value = ''
  const name = form.name.trim()
  const openapi_schema = form.openapi_schema.trim()
  if (!name || !openapi_schema) {
    editorError.value = 'Enter a tool name and an OpenAPI schema.'
    return
  }
  const headers = form.headers
    .map((header) => ({ key: header.key.trim(), value: header.value }))
    .filter((header) => header.key || header.value)
  if (headers.some((header) => !header.key)) {
    editorError.value = 'Every header with a value needs a key.'
    return
  }
  saving.value = true
  try {
    await validateOpenAPISchema(openapi_schema)
    if (disposed) return
    const payload = { name, icon: form.icon.trim(), openapi_schema, headers }
    const response = editingId.value
      ? await updateApiToolProvider(editingId.value, payload)
      : await createApiToolProvider(payload)
    if (disposed) return
    Message.success(response.message || 'Tool saved.')
    saving.value = false
    closeEditor()
    await reload()
  } catch (cause) {
    if (!disposed) editorError.value = message(cause)
  } finally {
    saving.value = false
  }
}
const remove = async () => {
  if (!editingId.value || saving.value) return
  saving.value = true
  try {
    const response = await deleteApiToolProvider(editingId.value)
    if (disposed) return
    Message.success(response.message || 'Tool deleted.')
    saving.value = false
    closeEditor()
    await reload()
  } catch (cause) {
    if (!disposed) editorError.value = message(cause)
  } finally {
    saving.value = false
    confirmingDelete.value = false
  }
}
</script>

<template>
  <section aria-label="Custom tools" class="pb-6">
    <div v-if="listError" role="alert" class="mb-4 text-red-700">
      {{ listError }}
      <button
        type="button"
        class="underline"
        @click="providers.length ? loadPage() : loadPage(true)"
      >
        Retry
      </button>
    </div>
    <!-- Provider cards -->
    <a-row :gutter="[20, 20]">
      <a-col v-for="provider in providers" :key="provider.id" :xs="24" :sm="12" :lg="6">
        <a-card hoverable class="rounded-lg" :data-provider="provider.id">
          <button
            type="button"
            class="w-full text-left cursor-pointer"
            :aria-label="`View ${provider.name} tools`"
            @click="selectedProvider = provider"
          >
            <div class="flex items-center gap-3 mb-3">
              <a-avatar :size="40" shape="square" :image-url="provider.icon || undefined">
                {{ provider.name.charAt(0).toUpperCase() }}
              </a-avatar>
              <div class="flex flex-col min-w-0">
                <div class="text-base text-gray-900 font-bold truncate">{{ provider.name }}</div>
                <div class="text-xs text-gray-500 line-clamp-1">
                  {{ provider.tools.length }} tools
                </div>
              </div>
            </div>
            <div class="leading-[18px] text-gray-500 h-[72px] line-clamp-4 mb-2">
              {{ provider.description }}
            </div>
            <div class="flex items-center gap-1.5">
              <a-avatar :size="18" class="bg-blue-700">
                <icon-user />
              </a-avatar>
              <div class="text-xs text-gray-400">
                {{ accountStore.account?.name || 'You' }} · Edited
                {{ moment.unix(provider.created_at).format('MM-DD HH:mm') }}
              </div>
            </div>
          </button>
        </a-card>
      </a-col>
      <a-col v-if="!loading && !listError && providers.length === 0" :span="24">
        <a-empty
          description="No custom tools yet."
          class="h-[400px] flex flex-col items-center justify-center"
        />
      </a-col>
    </a-row>
    <!-- Pagination status; the sentinel triggers loading the next page. -->
    <div ref="sentinel" class="my-4 flex justify-center text-gray-400">
      <a-space v-if="loading">
        <a-spin />
        <span role="status">Loading…</span>
      </a-space>
      <button
        v-else-if="hasMore && !listError && !canObserve"
        type="button"
        class="underline"
        @click="loadPage()"
      >
        Load more
      </button>
      <span v-else-if="providers.length > 0 && !hasMore">All tools loaded</span>
    </div>

    <!-- Provider details drawer -->
    <a-drawer
      :visible="selectedProvider !== null"
      :width="350"
      :footer="false"
      title="Tool Details"
      :drawer-style="{ background: '#F9FAFB' }"
      @cancel="selectedProvider = null"
    >
      <div v-if="selectedProvider">
        <div class="flex items-center gap-3 mb-3">
          <a-avatar :size="40" shape="square" :image-url="selectedProvider.icon || undefined">
            {{ selectedProvider.name.charAt(0).toUpperCase() }}
          </a-avatar>
          <div class="flex flex-col min-w-0">
            <div class="text-base text-gray-900 font-bold truncate">
              {{ selectedProvider.name }}
            </div>
            <div class="text-xs text-gray-500">{{ selectedProvider.tools.length }} tools</div>
          </div>
        </div>
        <div class="leading-[18px] text-gray-500 mb-4">{{ selectedProvider.description }}</div>
        <a-button
          :loading="loadingDetails"
          type="dashed"
          long
          class="mb-2 rounded-lg"
          @click="openEdit"
        >
          <template #icon><icon-settings /></template>
          Edit Tool
        </a-button>
        <hr class="my-4" />
        <ToolList :tools="selectedProvider.tools" />
      </div>
    </a-drawer>

    <!-- Create/edit dialog -->
    <a-modal
      :visible="editorOpen"
      :width="630"
      hide-title
      :footer="false"
      unmount-on-close
      modal-class="rounded-xl"
      @cancel="closeEditor"
    >
      <form aria-label="Custom tool editor" @submit.prevent="save">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-gray-700">
            {{ editingId ? 'Update Tool' : 'Create Tool' }}
          </h2>
          <a-button
            type="text"
            class="!text-gray-700"
            size="small"
            aria-label="Close"
            @click="closeEditor"
          >
            <template #icon><icon-close /></template>
          </a-button>
        </div>
        <fieldset :disabled="saving" class="pt-6 flex flex-col gap-5">
          <div class="flex items-center gap-4">
            <a-avatar :size="56" shape="square" :image-url="form.icon.trim() || undefined">
              {{ form.name.trim().charAt(0).toUpperCase() || '?' }}
            </a-avatar>
            <label class="flex flex-1 flex-col gap-1 text-sm text-gray-700">
              Icon URL
              <a-input v-model="form.icon" placeholder="https://example.com/icon.png" />
            </label>
          </div>
          <label class="flex flex-col gap-1 text-sm text-gray-700">
            <span>Tool name <span class="text-red-700">*</span></span>
            <a-input
              v-model="form.name"
              placeholder="Enter a clear, descriptive tool name"
              show-word-limit
              :max-length="60"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm text-gray-700">
            <span>OpenAPI Schema <span class="text-red-700">*</span></span>
            <a-textarea
              v-model="form.openapi_schema"
              :auto-size="{ minRows: 4, maxRows: 6 }"
              placeholder="Paste your OpenAPI schema here"
              @blur="validateSchema"
            />
            <span v-if="schemaError" class="text-xs text-red-700">{{ schemaError }}</span>
          </label>
          <!-- Tools found in the schema -->
          <div class="flex flex-col gap-1 text-sm text-gray-700">
            Available tools
            <div class="rounded-lg border border-gray-200 w-full overflow-x-auto">
              <table class="w-full leading-[18px] text-xs text-gray-700 text-left">
                <thead class="text-gray-500">
                  <tr class="border-b border-gray-200">
                    <th class="p-2 pl-3 font-medium">Name</th>
                    <th class="p-2 pl-3 font-medium w-[236px]">Description</th>
                    <th class="p-2 pl-3 font-medium">Method</th>
                    <th class="p-2 pl-3 font-medium">Path</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="tool in schemaTools"
                    :key="`${tool.method} ${tool.path}`"
                    class="border-b last:border-0 border-gray-200"
                  >
                    <td class="p-2 pl-3">{{ tool.name }}</td>
                    <td class="p-2 pl-3 w-[236px]">{{ tool.description }}</td>
                    <td class="p-2 pl-3 uppercase">{{ tool.method }}</td>
                    <td class="p-2 pl-3">{{ tool.path }}</td>
                  </tr>
                  <tr v-if="schemaTools.length === 0">
                    <td colspan="4" class="p-2 pl-3 text-gray-400">
                      No tools found. Each GET or POST operation needs an operationId and a
                      description.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <!-- Request headers -->
          <div class="flex flex-col gap-1 text-sm text-gray-700">
            Headers
            <div class="rounded-lg border border-gray-200 w-full overflow-x-auto">
              <table class="w-full leading-[18px] text-xs text-gray-700 text-left mb-3">
                <thead class="text-gray-500">
                  <tr class="border-b border-gray-200">
                    <th class="p-2 pl-3 font-medium">Key</th>
                    <th class="p-2 pl-3 font-medium">Value</th>
                    <th class="p-2 pl-3 font-medium w-[50px]">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(header, idx) in form.headers"
                    :key="idx"
                    class="border-b last:border-0 border-gray-200"
                  >
                    <td class="p-2 pl-3">
                      <a-input
                        v-model="header.key"
                        placeholder="Header name"
                        :input-attrs="{ 'aria-label': `Header ${idx + 1} key` }"
                      />
                    </td>
                    <td class="p-2 pl-3">
                      <a-input
                        v-model="header.value"
                        placeholder="Header value"
                        :input-attrs="{ 'aria-label': `Header ${idx + 1} value` }"
                      />
                    </td>
                    <td class="p-2 pl-3">
                      <a-button
                        size="mini"
                        type="text"
                        class="!text-gray-700"
                        :aria-label="`Remove header ${idx + 1}`"
                        @click="form.headers.splice(idx, 1)"
                      >
                        <template #icon><icon-delete /></template>
                      </a-button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <a-button
                size="mini"
                class="rounded ml-3 mb-3 !text-gray-700"
                @click="form.headers.push({ key: '', value: '' })"
              >
                <template #icon><icon-plus /></template>
                Add header
              </a-button>
            </div>
          </div>
          <p v-if="editorError" role="alert" class="text-sm text-red-700">{{ editorError }}</p>
          <!-- Delete confirmation -->
          <div
            v-if="confirmingDelete"
            role="alertdialog"
            aria-label="Delete this tool?"
            class="rounded-lg border border-red-200 bg-red-50 p-3 text-sm"
          >
            <p class="font-medium text-gray-900">Delete this tool?</p>
            <p class="text-gray-600 mb-3">
              Deleting a tool cannot be undone. AI apps will no longer be able to use it.
            </p>
            <a-space>
              <a-button status="danger" type="primary" class="rounded-lg" @click="remove">
                Confirm delete
              </a-button>
              <a-button class="rounded-lg" @click="confirmingDelete = false">Keep tool</a-button>
            </a-space>
          </div>
          <!-- Footer actions -->
          <div class="flex items-center justify-between">
            <a-button
              v-if="editingId && !confirmingDelete"
              class="rounded-lg !text-red-700"
              @click="confirmingDelete = true"
            >
              Delete
            </a-button>
            <span v-else />
            <a-space :size="16">
              <a-button class="rounded-lg" @click="closeEditor">Cancel</a-button>
              <a-button :loading="saving" type="primary" html-type="submit" class="rounded-lg">
                Save
              </a-button>
            </a-space>
          </div>
        </fieldset>
      </form>
    </a-modal>
  </section>
</template>
