<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getApps } from '@/services/app'
import type { AppSummary } from '@/models/app'

const router = useRouter()
const appId = ref('')
const error = ref('')
const listError = ref('')
const apps = ref<AppSummary[]>([])
const page = ref(1)
const totalPages = ref(0)
const search = ref('')
const isLoading = ref(false)
let activeRequest: AbortController | undefined

const loadApps = async (requestedPage = 1) => {
  activeRequest?.abort()
  const controller = new AbortController()
  activeRequest = controller
  isLoading.value = true
  listError.value = ''
  try {
    const data = await getApps(requestedPage, search.value.trim(), controller.signal)
    if (activeRequest !== controller) return
    apps.value = data.list
    page.value = data.paginator.current_page
    totalPages.value = data.paginator.total_page
  } catch (cause) {
    if (activeRequest !== controller) return
    listError.value = cause instanceof Error ? cause.message : 'Unable to load applications.'
  } finally {
    if (activeRequest === controller) {
      activeRequest = undefined
      isLoading.value = false
    }
  }
}
onMounted(() => loadApps())
onBeforeUnmount(() => {
  activeRequest?.abort()
  activeRequest = undefined
})

const openApp = () => {
  const id = appId.value.trim()
  if (!id) {
    error.value = 'Enter an application ID.'
    return
  }
  error.value = ''
  void router.push({ name: 'space-apps-detail', params: { app_id: id } })
}
</script>

<template>
  <main class="max-w-2xl mx-auto px-6 py-12">
    <h1 class="text-2xl font-semibold mb-4">Applications</h1>
    <p class="text-gray-600 mb-6">
      Select an application from your account, or open it directly by ID.
    </p>
    <form class="flex gap-3 mb-6" aria-label="Search applications" @submit.prevent="loadApps(1)">
      <input
        v-model="search"
        type="search"
        aria-label="Search applications"
        placeholder="Search applications"
        class="border rounded px-3 py-2 min-w-0 flex-1"
      />
      <button type="submit" class="border rounded px-4 py-2">Search</button>
    </form>
    <p v-if="isLoading" role="status">Loading applications…</p>
    <div v-if="listError" role="alert" class="text-red-700 mb-4">
      {{ listError }} <button type="button" class="underline" @click="loadApps(page)">Retry</button>
    </div>
    <ul v-if="!listError" class="flex flex-col gap-3 mb-6">
      <li v-for="app in apps" :key="app.id" class="border rounded p-4">
        <router-link
          :to="{ name: 'space-apps-detail', params: { app_id: app.id } }"
          class="text-blue-700 underline font-semibold"
          >{{ app.name }}</router-link
        >
        <p class="text-gray-600">{{ app.description }}</p>
        <span class="text-sm text-gray-500">{{ app.status }}</span>
      </li>
    </ul>
    <p v-if="!isLoading && !listError && !apps.length" class="mb-6 text-gray-600">
      No applications found.
    </p>
    <div v-if="totalPages > 1" class="flex gap-4 items-center mb-6">
      <button
        :disabled="isLoading || page <= 1"
        class="underline disabled:opacity-50"
        @click="loadApps(page - 1)"
      >
        Previous
      </button>
      <span>Page {{ page }} of {{ totalPages }}</span>
      <button
        :disabled="isLoading || page >= totalPages"
        class="underline disabled:opacity-50"
        @click="loadApps(page + 1)"
      >
        Next
      </button>
    </div>
    <form class="flex flex-col gap-3" @submit.prevent="openApp">
      <label for="app-id" class="font-semibold">Application ID</label>
      <input
        id="app-id"
        v-model="appId"
        class="border rounded px-3 py-2"
        placeholder="Enter application ID"
        required
      />
      <p v-if="error" role="alert" class="text-red-700">{{ error }}</p>
      <button class="bg-blue-700 text-white rounded px-4 py-2 self-start" type="submit">
        Open debug preview
      </button>
    </form>
  </main>
</template>
