<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  createApiToolProvider,
  deleteApiToolProvider,
  getApiToolProvider,
  getApiToolProvidersWithPage,
  updateApiToolProvider,
  validateOpenAPISchema,
} from '@/services/api-tool'
import { uploadImage } from '@/services/upload-file'
import type { GetApiToolProvidersWithPageResponse } from '@/models/api-tool'
import moment from 'moment'
import { typeMap } from '@/config'
import { useAccountStore } from '@/stores/account'
import {
  Message,
  Modal,
  type FileItem,
  type FormInstance,
  type RequestOption,
  type ValidatedError,
} from '@arco-design/web-vue'

type ApiToolProvider = GetApiToolProvidersWithPageResponse['data']['list'][number]

// Tool name limit enforced by the backend's CreateApiToolReq / UpdateApiToolProviderReq
const NAME_MAX_LENGTH = 30

const route = useRoute()
const accountStore = useAccountStore()
const props = defineProps<{ createType?: string }>()
const emits = defineEmits<{ 'update-create-type': [value: string] }>()
const providers = reactive<ApiToolProvider[]>([])
const paginator = reactive({
  current_page: 1,
  page_size: 20,
  total_page: 0,
  total_record: 0,
})
const form = reactive({
  icon: 'https://picsum.photos/400',
  name: '',
  openapi_schema: '',
  headers: [] as Array<{ key: string; value: string }>,
})
const formRef = ref<FormInstance>()
const iconFileList = ref<FileItem[]>([])
const loader = ref<HTMLElement>()
const showIdx = ref<number>(-1)
const loading = ref<boolean>(false)
const showUpdateModal = ref<boolean>(false)
const showUpdateModalLoading = ref<boolean>(false)
const submitLoading = ref<boolean>(false)
const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'Something went wrong. Please try again.'
const tools = computed(() => {
  try {
    // 1. Parse the openapi_schema data
    const available_tools = []
    const openapi_schema = JSON.parse(form.openapi_schema)

    // 2. Check whether paths exist
    if (openapi_schema && typeof openapi_schema === 'object' && 'paths' in openapi_schema) {
      // 3. Loop over all paths and extract the tools
      for (const path in openapi_schema['paths']) {
        // 4. Go through the get and post methods under each path
        for (const method in openapi_schema['paths'][path]) {
          if (['get', 'post'].includes(method)) {
            // 5. Extract the tool and check it has both operationId and description
            const tool = openapi_schema['paths'][path][method]
            if (tool && 'operationId' in tool && 'description' in tool) {
              available_tools.push({
                name: String(tool.operationId),
                description: String(tool.description),
                method: method,
                path: path,
              })
            }
          }
        }
      }
    }
    return available_tools
  } catch {
    // The schema is not valid JSON yet
    return []
  }
})

// Load more data
const loadMoreData = async (init: boolean = false) => {
  // 1. Check whether more data needs loading
  if (!init && paginator.current_page > paginator.total_page) return

  // 2. Load more data and update the data state
  try {
    // 3. Call the API to get the response data
    loading.value = true
    const resp = await getApiToolProvidersWithPage(
      paginator.current_page,
      paginator.page_size,
      String(route.query?.search_word ?? ''),
    )
    const data = resp.data

    // 4. Update the paginator
    paginator.current_page = data.paginator.current_page
    paginator.page_size = data.paginator.page_size
    paginator.total_page = data.paginator.total_page
    paginator.total_record = data.paginator.total_record

    // 5. Check whether more data exists
    if (paginator.current_page <= paginator.total_page) {
      paginator.current_page += 1
    }

    // 6. Append or replace the data
    if (init) {
      providers.splice(0, providers.length, ...data.list)
    } else {
      providers.push(...data.list)
    }
  } catch (cause) {
    Message.error(errorMessage(cause))
  } finally {
    loading.value = false
  }
}

// Initialize the data
const initData = () => {
  // 1. Reset the paginator
  paginator.current_page = 1
  paginator.page_size = 20
  paginator.total_page = 0
  paginator.total_record = 0

  // 2. Load the first page
  return loadMoreData(true)
}

// Scroll pagination: load the next page when the loader at the end of the list comes into view
// (the page scrolls as a whole, so this watches the loader instead of a scroll container)
let observer: IntersectionObserver | undefined
const handleLoaderVisible = (entries: IntersectionObserverEntry[]) => {
  if (!entries.some((entry) => entry.isIntersecting) || loading.value) return
  void loadMoreData()
}

// Open the update modal
const handleUpdate = async () => {
  try {
    // 1. Get the provider_id currently shown
    showUpdateModalLoading.value = true
    const provider_id = providers[showIdx.value]!.id

    // 2. Fetch this tool provider's details by id
    const resp = await getApiToolProvider(provider_id)
    const data = resp.data

    // 3. Update the form data
    formRef.value?.resetFields()
    form.icon = data.icon
    form.name = data.name
    form.openapi_schema = data.openapi_schema
    form.headers = data.headers.map((header) => ({ ...header }))
    showUpdateModal.value = true
  } catch (cause) {
    Message.error(errorMessage(cause))
  } finally {
    showUpdateModalLoading.value = false
  }
}

// Delete the tool provider
const handleDelete = () => {
  Modal.warning({
    title: 'Delete this tool?',
    content: 'Deleting a tool cannot be undone. AI apps will no longer be able to use your tool.',
    hideCancel: false,
    okText: 'Delete',
    cancelText: 'Cancel',
    onOk: async () => {
      try {
        // 1. After confirming, send the request to the API
        const provider_id = providers[showIdx.value]!.id
        const resp = await deleteApiToolProvider(provider_id)
        Message.success(resp.message)
      } catch (cause) {
        Message.error(errorMessage(cause))
      } finally {
        // 2. Close the modal and the drawer
        handleCancel()
        showIdx.value = -1

        // 3. Reload the data
        await initData()
      }
    },
  })
}

// Submit the modal form
const handleSubmit = async ({
  errors,
}: {
  values: Record<string, unknown>
  errors: Record<string, ValidatedError> | undefined
}) => {
  // 1. Stop if there are validation errors
  if (errors) return

  try {
    // 2. Put the save button into the loading state to avoid repeated clicks
    submitLoading.value = true
    const payload = {
      icon: form.icon,
      name: form.name.trim(),
      openapi_schema: form.openapi_schema,
      headers: form.headers.map((header) => ({ ...header })),
    }

    // 3. Send a different request for each type
    if (props.createType === 'tool') {
      // 4. Call the API to create the tool
      const resp = await createApiToolProvider(payload)
      Message.success(resp.message)
    } else if (showUpdateModal.value) {
      // 5. Call the API to update the API tool
      const resp = await updateApiToolProvider(providers[showIdx.value]!.id, payload)
      Message.success(resp.message)
    }

    // 6. Follow-up: hide the modal and the drawer
    handleCancel()
    showIdx.value = -1
  } catch (cause) {
    Message.error(errorMessage(cause))
    return
  } finally {
    submitLoading.value = false
  }

  // 7. Reload the data
  await initData()
}

// Validate the OpenAPI schema when the textarea loses focus
const handleSchemaBlur = async () => {
  if (form.openapi_schema.trim() === '') return
  try {
    // Call the validate openapi_schema API
    await validateOpenAPISchema(form.openapi_schema)
  } catch (cause) {
    Message.error(errorMessage(cause))
  }
}

// Upload the icon to the backend and use the returned image URL
const handleIconUpload = (option: RequestOption) => {
  const file = option.fileItem.file
  if (file) {
    uploadImage(file)
      .then((resp) => {
        form.icon = resp.data.image_url
        option.onSuccess(resp)
      })
      .catch((cause) => {
        Message.error(errorMessage(cause))
        option.onError(cause)
      })
  }
  return {}
}

// Removing the picture clears the icon
const handleIconChange = (fileList: FileItem[]) => {
  if (fileList.length === 0) form.icon = ''
}

// Close the modal
const handleCancel = () => {
  // 1. Reset all the form data
  formRef.value?.resetFields()

  // 2. Hide the form modal
  emits('update-create-type', '')
  showUpdateModal.value = false
}

// Initialize the data once the page DOM is mounted
onMounted(async () => {
  await initData()
  if (typeof IntersectionObserver !== 'undefined' && loader.value) {
    observer = new IntersectionObserver(handleLoaderVisible, { rootMargin: '200px' })
    observer.observe(loader.value)
  }
})

onBeforeUnmount(() => observer?.disconnect())

// Watch the route query for changes
watch(
  () => route.query?.search_word,
  async () => {
    await initData()
  },
)

// Show the current icon in the upload picture card
watch(
  () => form.icon,
  (icon) => {
    if (iconFileList.value[0]?.url === icon) return
    iconFileList.value = icon ? [{ uid: 'icon', url: icon, status: 'done' }] : []
  },
  { immediate: true },
)
</script>

<template>
  <a-spin :loading="loading" class="block h-full w-full">
    <!-- Bottom tool list -->
    <a-row :gutter="[20, 20]" class="flex-1">
      <!-- UI state with data -->
      <a-col
        v-for="(provider, idx) in providers"
        :key="provider.id"
        :xs="24"
        :sm="12"
        :lg="6"
        :data-provider="provider.id"
      >
        <a-card hoverable class="cursor-pointer rounded-lg" @click="showIdx = idx">
          <!-- Top provider name -->
          <div class="flex items-center gap-3 mb-3">
            <!-- Left icon -->
            <a-avatar :size="40" shape="square" :image-url="provider.icon" />
            <!-- Right tool information -->
            <div class="flex flex-col">
              <div class="text-base text-gray-900 font-bold">{{ provider.name }}</div>
              <div class="text-xs text-gray-500 line-clamp-1">
                Provider {{ provider.name }} · {{ provider.tools.length }} tools
              </div>
            </div>
          </div>
          <!-- Provider description -->
          <div class="leading-[18px] text-gray-500 h-[72px] line-clamp-4 mb-2">
            {{ provider.description }}
          </div>
          <!-- Provider edit information -->
          <div class="flex items-center gap-1.5">
            <a-avatar :size="18" class="bg-blue-700">
              <icon-user />
            </a-avatar>
            <div class="text-xs text-gray-400">
              {{ accountStore.account?.name || 'You' }} · Edited
              {{ moment.unix(provider.created_at).format('MM-DD HH:mm') }}
            </div>
          </div>
        </a-card>
      </a-col>
      <!-- UI state without data -->
      <a-col v-if="!loading && providers.length === 0" :span="24">
        <a-empty
          description="No API tools available"
          class="h-[400px] flex flex-col items-center justify-center"
        />
      </a-col>
    </a-row>
    <!-- Loader -->
    <div ref="loader">
      <a-row v-if="providers.length > 0">
        <!-- Loading data -->
        <a-col v-if="paginator.current_page <= paginator.total_page" :span="24" align="center">
          <a-space class="my-4">
            <a-spin />
            <div class="text-gray-400">Loading</div>
          </a-space>
        </a-col>
        <!-- All data loaded -->
        <a-col v-else :span="24" align="center">
          <div class="text-gray-400 my-4">All data loaded</div>
        </a-col>
      </a-row>
    </div>
    <!-- Card drawer -->
    <a-drawer
      :visible="showIdx != -1"
      :width="350"
      :footer="false"
      title="Tool Details"
      :drawer-style="{ background: '#F9FAFB' }"
      @cancel="showIdx = -1"
    >
      <!-- Outer container: hidden when showIdx is -1 -->
      <div v-if="showIdx != -1 && providers[showIdx]" class="">
        <!-- Top provider name -->
        <div class="flex items-center gap-3 mb-3">
          <!-- Left icon -->
          <a-avatar :size="40" shape="square" :image-url="providers[showIdx].icon" />
          <!-- Right tool information -->
          <div class="flex flex-col">
            <div class="text-base text-gray-900 font-bold">
              {{ providers[showIdx].name }}
            </div>
            <div class="text-xs text-gray-500 line-clamp-1">
              Provider {{ providers[showIdx].name }} · {{ providers[showIdx].tools.length }} tools
            </div>
          </div>
        </div>
        <!-- Provider description -->
        <div class="leading-[18px] text-gray-500 mb-4">
          {{ providers[showIdx].description }}
        </div>
        <!-- Edit button -->
        <a-button
          :loading="showUpdateModalLoading"
          type="dashed"
          long
          class="mb-2 rounded-lg"
          @click="handleUpdate"
        >
          <template #icon>
            <icon-settings />
          </template>
          Edit Tool
        </a-button>
        <!-- Divider -->
        <hr class="my-4" />
        <!-- Provider tools -->
        <div class="flex flex-col gap-2">
          <div class="text-xs text-gray-500">
            Includes {{ providers[showIdx].tools.length }} tools
          </div>
          <!-- Tool list -->
          <a-card
            v-for="tool in providers[showIdx].tools"
            :key="tool.name"
            class="cursor-pointer flex flex-col rounded-xl"
          >
            <!-- Tool name -->
            <div class="font-bold text-gray-900 mb-2">{{ tool.name }}</div>
            <!-- Tool description -->
            <div class="text-gray-500 text-xs">{{ tool.description }}</div>
            <!-- Tool parameters -->
            <div v-if="tool.inputs.length > 0" class="">
              <!-- Divider -->
              <div class="flex items-center gap-2 my-4">
                <div class="text-xs font-bold text-gray-500">Parameters</div>
                <hr class="flex-1" />
              </div>
              <!-- Parameter list -->
              <div class="flex flex-col gap-4">
                <div v-for="input in tool.inputs" :key="input.name" class="flex flex-col gap-2">
                  <!-- Upper part -->
                  <div class="flex items-center gap-2 text-xs">
                    <div class="text-gray-900 font-bold">{{ input.name }}</div>
                    <div class="text-gray-500">{{ typeMap[input.type] || input.type }}</div>
                    <div v-if="input.required" class="text-red-700">Required</div>
                  </div>
                  <!-- Parameter description -->
                  <div class="text-xs text-gray-500">{{ input.description }}</div>
                </div>
              </div>
            </div>
          </a-card>
        </div>
      </div>
    </a-drawer>
    <!-- Create/update modal -->
    <a-modal
      :width="630"
      :visible="props.createType === 'tool' || showUpdateModal"
      hide-title
      :footer="false"
      modal-class="rounded-xl"
      @cancel="handleCancel"
    >
      <!-- Top title -->
      <div class="flex items-center justify-between">
        <div class="text-lg font-bold text-gray-700">
          {{ props.createType === 'tool' ? 'Create' : 'Update' }} Tool
        </div>
        <a-button
          type="text"
          class="!text-gray-700"
          size="small"
          aria-label="Close"
          @click="handleCancel"
        >
          <template #icon>
            <icon-close />
          </template>
        </a-button>
      </div>
      <!-- Middle form -->
      <div class="pt-6">
        <a-form
          ref="formRef"
          :model="form"
          layout="vertical"
          aria-label="Custom tool editor"
          @submit="handleSubmit"
        >
          <a-form-item
            field="icon"
            hide-label
            :rules="[{ required: true, message: 'The tool icon is required' }]"
          >
            <a-upload
              v-model:file-list="iconFileList"
              :limit="1"
              list-type="picture-card"
              accept="image/png, image/jpeg"
              class="!w-auto mx-auto"
              :custom-request="handleIconUpload"
              @change="handleIconChange"
            />
          </a-form-item>
          <a-form-item
            field="name"
            label="Tool Name"
            asterisk-position="end"
            :rules="[{ required: true, message: 'The tool name is required' }]"
          >
            <a-input
              v-model="form.name"
              placeholder="Enter a tool name with a clear meaning"
              show-word-limit
              :max-length="NAME_MAX_LENGTH"
            />
          </a-form-item>
          <a-form-item
            field="openapi_schema"
            label="OpenAPI Schema"
            asterisk-position="end"
            :rules="[{ required: true, message: 'The OpenAPI schema is required' }]"
          >
            <a-textarea
              v-model="form.openapi_schema"
              :auto-size="{ minRows: 4, maxRows: 6 }"
              placeholder="Enter your OpenAPI schema here"
              @blur="handleSchemaBlur"
            />
          </a-form-item>
          <a-form-item label="Available Tools">
            <!-- Available tools table -->
            <div class="rounded-lg border border-gray-200 w-full overflow-x-auto">
              <table class="w-full leading-[18px] text-xs text-gray-700 font-normal">
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
                    v-for="(tool, idx) in tools"
                    :key="idx"
                    class="border-b last:border-0 border-gray-200 text-gray-700"
                  >
                    <td class="p-2 pl-3">{{ tool.name }}</td>
                    <td class="p-2 pl-3 w-[236px]">{{ tool.description }}</td>
                    <td class="p-2 pl-3">{{ tool.method }}</td>
                    <td class="p-2 pl-3 w-[62px]">{{ tool.path }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </a-form-item>
          <a-form-item label="Headers">
            <!-- Request headers form -->
            <div class="rounded-lg border border-gray-200 w-full overflow-x-auto">
              <table class="w-full leading-[18px] text-xs text-gray-700 font-normal mb-3">
                <thead class="text-gray-500">
                  <tr class="border-b border-gray-200">
                    <th class="p-2 pl-3 font-medium">Key</th>
                    <th class="p-2 pl-3 font-medium">Value</th>
                    <th class="p-2 pl-3 font-medium w-[50px]">Actions</th>
                  </tr>
                </thead>
                <tbody v-if="form.headers.length > 0" class="border-b border-gray-200">
                  <tr
                    v-for="(header, idx) in form.headers"
                    :key="idx"
                    class="border-b last:border-0 border-gray-200"
                  >
                    <td class="p-2 pl-3">
                      <a-form-item :field="`headers[${idx}].key`" hide-label class="m-0">
                        <a-input v-model="header.key" placeholder="Enter the header key" />
                      </a-form-item>
                    </td>
                    <td class="p-2 pl-3">
                      <a-form-item :field="`headers[${idx}].value`" hide-label class="m-0">
                        <a-input v-model="header.value" placeholder="Enter the header value" />
                      </a-form-item>
                    </td>
                    <td class="p-2 pl-3">
                      <a-button
                        size="mini"
                        type="text"
                        class="!text-gray-700"
                        aria-label="Remove header"
                        @click="form.headers.splice(idx, 1)"
                      >
                        <template #icon>
                          <icon-delete />
                        </template>
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
                <template #icon>
                  <icon-plus />
                </template>
                Add Header
              </a-button>
            </div>
          </a-form-item>
          <!-- Bottom buttons -->
          <div class="flex items-center justify-between">
            <div class="">
              <a-button
                v-if="showUpdateModal"
                class="rounded-lg !text-red-700"
                @click="handleDelete"
              >
                Delete
              </a-button>
            </div>
            <a-space :size="16">
              <a-button class="rounded-lg" @click="handleCancel">Cancel</a-button>
              <a-button
                :loading="submitLoading"
                type="primary"
                html-type="submit"
                class="rounded-lg"
              >
                Save
              </a-button>
            </a-space>
          </div>
        </a-form>
      </div>
    </a-modal>
  </a-spin>
</template>

<style scoped></style>
