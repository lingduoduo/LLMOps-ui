<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { GetBuiltinAppCategoriesResponse, GetBuiltinAppsResponse } from '@/models/builtin-app'
import {
  getBuiltinApps,
  getBuiltinAppCategories,
  addBuiltinAppToSpace,
} from '@/services/builtin-app'
import { getAccessToken } from '@/utils/auth'

type BuiltinApp = GetBuiltinAppsResponse['data'][number]
type BuiltinAppCategory = GetBuiltinAppCategoriesResponse['data'][number]

const router = useRouter()
const apps = ref<BuiltinApp[]>([])
const categories = ref<BuiltinAppCategory[]>([])
const query = ref('')
const category = ref('')
const loading = ref(false)
const error = ref('')
const addError = ref('')
const adding = ref('')
let active = true
let generation = 0
let readController: AbortController | undefined
const writeController = new AbortController()
const filteredApps = computed(() => {
  const search = query.value.trim().toLowerCase()
  return apps.value.filter(
    (app) =>
      (!category.value || app.category === category.value) &&
      (!search || `${app.name} ${app.description}`.toLowerCase().includes(search)),
  )
})
const categoryName = (value: string) =>
  categories.value.find((item) => item.category === value)?.name ?? value
const imageUrl = (value: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol) ? value : ''
  } catch {
    return ''
  }
}
async function load() {
  readController?.abort()
  readController = new AbortController()
  const version = ++generation
  const token = getAccessToken()
  const current = () => active && generation === version && getAccessToken() === token
  loading.value = true
  error.value = ''
  try {
    const [catalog, groups] = await Promise.all([
      getBuiltinApps(readController.signal),
      getBuiltinAppCategories(readController.signal),
    ])
    if (!current()) return
    apps.value = catalog
    categories.value = groups
  } catch (cause) {
    if (current())
      error.value = cause instanceof Error ? cause.message : 'Unable to load the app marketplace.'
  } finally {
    if (active && generation === version) loading.value = false
  }
}
async function add(app: BuiltinApp) {
  if (adding.value) return
  adding.value = app.id
  addError.value = ''
  const token = getAccessToken()
  try {
    const result = await addBuiltinAppToSpace(app.id, writeController.signal)
    if (active && getAccessToken() === token)
      await router.push({ name: 'space-apps-detail', params: { app_id: result.id } })
  } catch (cause) {
    if (active && getAccessToken() === token)
      addError.value =
        cause instanceof Error ? cause.message : 'Unable to add this app. Please try again.'
  } finally {
    if (active) adding.value = ''
  }
}
onMounted(load)
onBeforeUnmount(() => {
  active = false
  ++generation
  readController?.abort()
  writeController.abort()
})
</script>

<template>
  <main class="h-full overflow-y-auto bg-gray-50 p-6 lg:p-8">
    <header class="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">App Marketplace</h1>
        <p class="mt-2 text-sm text-gray-500">
          Start with a ready-made app, then make it your own in Personal Space.
        </p>
      </div>
      <div class="w-full sm:w-72">
        <label for="app-search" class="sr-only">Search apps</label
        ><input
          id="app-search"
          v-model="query"
          type="search"
          placeholder="Search apps"
          class="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm"
        />
      </div>
    </header>
    <nav aria-label="App categories" class="mb-6 flex flex-wrap gap-2">
      <button
        :aria-pressed="category === ''"
        class="rounded-lg border px-4 py-2 text-sm"
        :class="
          category === ''
            ? 'border-blue-600 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-600'
        "
        @click="category = ''"
      >
        All apps
      </button>
      <button
        v-for="item in categories"
        :key="item.category"
        :data-category="item.category"
        :aria-pressed="category === item.category"
        class="rounded-lg border px-4 py-2 text-sm"
        :class="
          category === item.category
            ? 'border-blue-600 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-600'
        "
        @click="category = item.category"
      >
        {{ item.name }}
      </button>
    </nav>
    <p v-if="loading" role="status" class="py-12 text-center text-sm text-gray-500">
      Loading apps…
    </p>
    <div
      v-else-if="error"
      role="alert"
      class="rounded-xl border border-red-100 bg-white p-6 text-sm text-red-600"
    >
      {{ error
      }}<button class="ml-4 text-blue-600 underline" aria-label="Retry loading apps" @click="load">
        Retry
      </button>
    </div>
    <template v-else>
      <p v-if="addError" role="alert" class="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-600">
        {{ addError }}
      </p>
      <div v-if="filteredApps.length" class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="app in filteredApps"
          :key="app.id"
          :data-app="app.id"
          class="flex flex-col rounded-xl border border-gray-200 bg-white p-5"
        >
          <div class="mb-4 flex items-center gap-3">
            <img
              v-if="imageUrl(app.icon)"
              :src="imageUrl(app.icon)"
              alt=""
              class="h-11 w-11 rounded-xl object-cover"
            /><span
              v-else
              aria-hidden="true"
              class="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-lg font-semibold text-blue-600"
              >{{ app.name.charAt(0).toUpperCase() }}</span
            >
            <div class="min-w-0">
              <h2 class="break-words font-semibold text-gray-900">{{ app.name }}</h2>
              <p class="text-xs text-gray-500">{{ categoryName(app.category) }}</p>
            </div>
          </div>
          <p class="mb-5 flex-1 whitespace-pre-line break-words text-sm leading-6 text-gray-600">
            {{ app.description }}
          </p>
          <p class="mb-4 text-xs text-gray-400">
            {{ app.model_config.provider }} · {{ app.model_config.model }}
          </p>
          <button
            :aria-label="`Add ${app.name} to Personal Space`"
            :disabled="Boolean(adding)"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            @click="add(app)"
          >
            {{ adding === app.id ? 'Adding…' : 'Add to Personal Space' }}
          </button>
        </article>
      </div>
      <p
        v-else
        class="rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-500"
      >
        {{
          apps.length
            ? 'No apps match your search or category.'
            : 'No marketplace apps are available yet.'
        }}
      </p>
    </template>
  </main>
</template>
