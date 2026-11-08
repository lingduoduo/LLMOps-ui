<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { IconCommon, IconUser } from '@arco-design/web-vue/es/icon'
import { getBuiltinTools, getCategories } from '@/services/builtin-tool'
import { apiPrefix } from '@/config'
import type { BuiltinToolProvider, ToolCategory } from '@/models/builtin-tool'
import { formatDate } from '@/utils/format'
import ToolList from '@/components/ToolList.vue'

const router = useRouter()
const categories = ref<ToolCategory[]>([])
const providers = ref<BuiltinToolProvider[]>([])
const loading = ref(false)
const error = ref('')
const category = ref('all')
const search = ref('')
const selectedProvider = ref<BuiltinToolProvider | null>(null)
let activeRequest: AbortController | undefined
const filterProviders = computed(() => {
  const term = search.value.trim().toLowerCase()
  return providers.value.filter(
    (item) =>
      (category.value === 'all' || item.category === category.value) &&
      (!term || item.label.toLowerCase().includes(term)),
  )
})
const load = async () => {
  activeRequest?.abort()
  const controller = new AbortController()
  activeRequest = controller
  loading.value = true
  error.value = ''
  try {
    const [categoryResponse, providerResponse] = await Promise.all([
      getCategories(controller.signal),
      getBuiltinTools(controller.signal),
    ])
    if (activeRequest !== controller) return
    categories.value = categoryResponse.data
    providers.value = providerResponse.data
    selectedProvider.value = null
  } catch (cause) {
    if (activeRequest === controller)
      error.value = cause instanceof Error ? cause.message : 'Unable to load tools.'
  } finally {
    if (activeRequest === controller) {
      activeRequest = undefined
      loading.value = false
    }
  }
}
onMounted(load)
onBeforeUnmount(() => {
  activeRequest?.abort()
  activeRequest = undefined
})
const providerIcon = (name: string) => `${apiPrefix}/builtin-tools/${encodeURIComponent(name)}/icon`
</script>

<template>
  <a-spin :loading="loading" class="block h-full w-full">
    <div class="p-6 flex flex-col">
      <!-- Page title and create button -->
      <div class="flex items-center justify-between mb-6">
        <!-- Page title -->
        <div class="flex items-center gap-2">
          <a-avatar :size="32" class="bg-blue-700">
            <icon-common :size="18" />
          </a-avatar>
          <h1 class="text-lg font-medium text-gray-900">Tool Marketplace</h1>
        </div>
        <!-- Create button: custom tools live in Personal Space, which opens its create dialog. -->
        <a-button
          type="primary"
          class="rounded-lg"
          @click="router.push({ name: 'space-tools-list', query: { create: 'tool' } })"
          >Create Custom Tool</a-button
        >
      </div>
      <!-- Tool categories and search -->
      <div class="flex items-center justify-between mb-6">
        <!-- Category filters -->
        <div class="flex items-center gap-2">
          <a-button
            :type="category === 'all' ? 'secondary' : 'text'"
            class="rounded-lg !text-gray-700 px-3"
            @click="category = 'all'"
            >All
          </a-button>
          <a-button
            v-for="item in categories"
            :key="item.category"
            :type="category === item.category ? 'secondary' : 'text'"
            class="rounded-lg !text-gray-700 px-3"
            @click="category = item.category"
          >
            {{ item.name }}
          </a-button>
        </div>
        <!-- Search -->
        <a-input-search
          v-model="search"
          placeholder="Search tools by name"
          class="w-[240px] bg-white rounded-lg border-gray-300"
        />
      </div>
      <div v-if="error" role="alert" class="mb-4 text-red-700">
        {{ error }}
        <button type="button" aria-label="Retry loading tools" class="underline" @click="load">
          Retry
        </button>
      </div>
      <!-- Tool provider list -->
      <a-row :gutter="[20, 20]" class="flex-1">
        <!-- Provider cards -->
        <a-col v-for="provider in filterProviders" :key="provider.name" :xs="24" :sm="12" :lg="6">
          <a-card hoverable class="rounded-lg" :data-provider="provider.name">
            <button
              type="button"
              class="w-full text-left cursor-pointer"
              :aria-label="`View ${provider.label} tools`"
              @click="selectedProvider = provider"
            >
              <!-- Provider header -->
              <div class="flex items-center gap-3 mb-3">
                <!-- Provider icon -->
                <a-avatar
                  :size="40"
                  shape="square"
                  :style="{ backgroundColor: provider.background }"
                >
                  <img :src="providerIcon(provider.name)" :alt="provider.name" />
                </a-avatar>
                <!-- Provider information -->
                <div class="flex flex-col">
                  <div class="text-base text-gray-900 font-bold">{{ provider.label }}</div>
                  <div class="text-xs text-gray-500 line-clamp-1">
                    Provider {{ provider.name }} · {{ provider.tools.length }} tools
                  </div>
                </div>
              </div>
              <!-- Provider description -->
              <div class="leading-[18px] text-gray-500 h-[72px] line-clamp-4 mb-2">
                {{ provider.description }}
              </div>
              <!-- Publication information -->
              <div class="flex items-center gap-1.5">
                <a-avatar :size="18" class="bg-blue-700">
                  <icon-user />
                </a-avatar>
                <div class="text-xs text-gray-400">
                  Published
                  {{ formatDate(provider.created_at) }}
                </div>
              </div>
            </button>
          </a-card>
        </a-col>
        <!-- Empty state -->
        <a-col v-if="!loading && !error && filterProviders.length === 0" :span="24">
          <a-empty
            description="No built-in tools available"
            class="h-[400px] flex flex-col items-center justify-center"
          />
        </a-col>
      </a-row>
      <!-- Tool details drawer -->
      <a-drawer
        :visible="selectedProvider !== null"
        :width="350"
        :footer="false"
        title="Tool Details"
        :drawer-style="{ background: '#F9FAFB' }"
        @cancel="selectedProvider = null"
      >
        <!-- Show details only when a provider is selected. -->
        <div v-if="selectedProvider !== null" class="">
          <!-- Provider header -->
          <div class="flex items-center gap-3 mb-3">
            <!-- Provider icon -->
            <a-avatar
              :size="40"
              shape="square"
              :style="{ backgroundColor: selectedProvider.background }"
            >
              <img :src="providerIcon(selectedProvider.name)" :alt="selectedProvider.name" />
            </a-avatar>
            <!-- Provider information -->
            <div class="flex flex-col">
              <div class="text-base text-gray-900 font-bold">
                {{ selectedProvider.label }}
              </div>
              <div class="text-xs text-gray-500 line-clamp-1">
                Provider {{ selectedProvider.name }} · {{ selectedProvider.tools.length }} tools
              </div>
            </div>
          </div>
          <!-- Provider description -->
          <div class="leading-[18px] text-gray-500 mb-2">
            {{ selectedProvider.description }}
          </div>
          <!-- Divider -->
          <hr class="my-4" />
          <!-- Provider tools -->
          <ToolList :tools="selectedProvider.tools" />
        </div>
      </a-drawer>
    </div>
  </a-spin>
</template>

<style scoped></style>
