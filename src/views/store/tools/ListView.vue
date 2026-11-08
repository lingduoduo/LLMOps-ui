<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getBuiltinTools, getCategories } from '@/services/builtin-tool'
import { apiPrefix, typeMap } from '@/config'
import type { BuiltinToolProvider, ToolCategory } from '@/models/builtin-tool'
import { formatMonthDayTime } from '@/utils/format'

// Declare variables
const router = useRouter()
const categories = reactive<ToolCategory[]>([])
const providers = reactive<BuiltinToolProvider[]>([])
const loading = ref<boolean>(false)
const error = ref<string>('')
const category = ref<string>('all')
const search_word = ref<string>('')
const showIdx = ref<number>(-1)
const filterProviders = computed(() => {
  const term = search_word.value.trim().toLowerCase()
  return providers.filter((item) => {
    // Match both the category and the search word; return only providers that satisfy both
    const matchCategory = category.value === 'all' || item.category === category.value
    const matchSearchWord = term === '' || item.label.toLowerCase().includes(term)

    return matchCategory && matchSearchWord
  })
})

// Load categories and providers together; a newer load (retry) or leaving the page cancels
// the request in flight so stale responses are ignored.
let activeRequest: AbortController | undefined
const load = async () => {
  activeRequest?.abort()
  const controller = new AbortController()
  activeRequest = controller
  try {
    loading.value = true
    error.value = ''
    const [categoryResp, providerResp] = await Promise.all([
      getCategories(controller.signal),
      getBuiltinTools(controller.signal),
    ])
    if (activeRequest !== controller) return
    showIdx.value = -1
    categories.splice(0, categories.length, ...categoryResp.data)
    providers.splice(0, providers.length, ...providerResp.data)
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
</script>

<template>
  <a-spin :loading="loading" class="block h-full w-full">
    <div class="p-6 flex flex-col">
      <!-- Top title + create button -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <!-- Left title -->
        <div class="flex items-center gap-2">
          <a-avatar :size="32" class="bg-blue-700">
            <icon-common :size="18" />
          </a-avatar>
          <div class="text-lg font-medium text-gray-900">Tool Marketplace</div>
        </div>
        <!-- Create button: opens the create dialog in Personal Space -->
        <a-button
          type="primary"
          class="rounded-lg"
          @click="router.push({ name: 'space-tools-list', query: { create: 'tool' } })"
          >Create Custom Tool</a-button
        >
      </div>
      <!-- Tool categories + search box -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <!-- Left categories -->
        <div class="flex flex-wrap items-center gap-2">
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
        <!-- Right search -->
        <a-input-search
          v-model="search_word"
          placeholder="Enter a tool name"
          class="w-full sm:w-[240px] bg-white rounded-lg border-gray-300"
        />
      </div>
      <!-- Load error with retry -->
      <div v-if="error" role="alert" class="mb-4 text-red-700">
        {{ error }}
        <button type="button" aria-label="Retry loading tools" class="underline" @click="load">
          Retry
        </button>
      </div>
      <!-- Bottom tool list -->
      <a-row :gutter="[20, 20]" class="flex-1">
        <!-- UI state with data -->
        <a-col
          v-for="(provider, idx) in filterProviders"
          :key="provider.name"
          :xs="24"
          :sm="12"
          :lg="6"
        >
          <!-- Keyboard accessible: focus with Tab, open with Enter or Space -->
          <a-card
            hoverable
            role="button"
            tabindex="0"
            :aria-label="`View ${provider.label} tools`"
            class="cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-blue-700"
            @click="showIdx = idx"
            @keydown.enter.prevent="showIdx = idx"
            @keydown.space.prevent="showIdx = idx"
          >
            <!-- Top provider name -->
            <div class="flex items-center gap-3 mb-3">
              <!-- Left icon -->
              <a-avatar :size="40" shape="square" :style="{ backgroundColor: provider.background }">
                <img
                  :src="`${apiPrefix}/builtin-tools/${provider.name}/icon`"
                  :alt="provider.name"
                />
              </a-avatar>
              <!-- Right tool information -->
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
            <!-- Provider publication information -->
            <div class="flex items-center gap-1.5">
              <a-avatar :size="18" class="bg-blue-700">
                <icon-user />
              </a-avatar>
              <div class="text-xs text-gray-400">
                LLMOps · Published
                {{ formatMonthDayTime(provider.created_at) }}
              </div>
            </div>
          </a-card>
        </a-col>
        <!-- UI state without data -->
        <a-col v-if="!loading && !error && filterProviders.length === 0" :span="24">
          <a-empty
            description="No built-in tools available"
            class="h-[400px] flex flex-col items-center justify-center"
          />
        </a-col>
      </a-row>
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
        <div v-if="showIdx != -1" class="">
          <!-- Top provider name -->
          <div class="flex items-center gap-3 mb-3">
            <!-- Left icon -->
            <a-avatar
              :size="40"
              shape="square"
              :style="{ backgroundColor: filterProviders[showIdx].background }"
            >
              <img
                :src="`${apiPrefix}/builtin-tools/${filterProviders[showIdx].name}/icon`"
                :alt="filterProviders[showIdx].name"
              />
            </a-avatar>
            <!-- Right tool information -->
            <div class="flex flex-col">
              <div class="text-base text-gray-900 font-bold">
                {{ filterProviders[showIdx].label }}
              </div>
              <div class="text-xs text-gray-500 line-clamp-1">
                Provider {{ filterProviders[showIdx].name }} ·
                {{ filterProviders[showIdx].tools.length }} tools
              </div>
            </div>
          </div>
          <!-- Provider description -->
          <div class="leading-[18px] text-gray-500 mb-2">
            {{ filterProviders[showIdx].description }}
          </div>
          <!-- Divider -->
          <hr class="my-4" />
          <!-- Provider tools -->
          <div class="flex flex-col gap-2">
            <div class="text-xs text-gray-500">
              Includes {{ filterProviders[showIdx].tools.length }} tools
            </div>
            <!-- Tool list -->
            <a-card
              v-for="tool in filterProviders[showIdx].tools"
              :key="tool.name"
              class="cursor-pointer flex flex-col rounded-xl"
            >
              <!-- Tool name -->
              <div class="font-bold text-gray-900 mb-2">{{ tool.label }}</div>
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
                      <div class="text-gray-500">{{ typeMap[input.type] }}</div>
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
    </div>
  </a-spin>
</template>

<style scoped></style>
