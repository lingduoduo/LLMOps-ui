<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// Tabs share one search box; the term lives in the `search_word` query so each list can react.
const tabs = [
  { routeName: 'space-apps-list', label: 'AI Apps' },
  { routeName: 'space-tools-list', label: 'Tools' },
  { routeName: 'space-workflows-list', label: 'Workflows' },
  { routeName: 'space-datasets-list', label: 'Knowledge Bases' },
] as const

const queryWord = () => (typeof route.query.search_word === 'string' ? route.query.search_word : '')
const searchWord = ref(queryWord())
watch(
  () => route.query.search_word,
  () => (searchWord.value = queryWord()),
)

const search = (value: string) => {
  const term = value.trim()
  void router.push({ path: route.path, query: term ? { search_word: term } : {} })
}
// The tools list opens its create dialog while the `create=tool` query is present.
const createTool = () => void router.push({ query: { ...route.query, create: 'tool' } })
</script>

<template>
  <div class="px-6 flex flex-col min-h-full">
    <div class="pt-6 sticky top-0 z-20 bg-white">
      <!-- Page title and create button -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-2">
          <a-avatar :size="32" class="bg-blue-700">
            <icon-user :size="18" />
          </a-avatar>
          <h1 class="text-lg font-medium text-gray-900">Personal Space</h1>
        </div>
        <a-button
          v-if="route.name === 'space-apps-list'"
          type="primary"
          class="rounded-lg"
          @click="router.push({ name: 'space-apps-create' })"
        >
          Create AI App
        </a-button>
        <a-button
          v-if="route.name === 'space-tools-list'"
          type="primary"
          class="rounded-lg"
          @click="createTool"
        >
          Create Custom Tool
        </a-button>
      </div>
      <!-- Section tabs and search -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <nav aria-label="Personal space sections" class="flex items-center gap-2">
          <router-link
            v-for="tab in tabs"
            :key="tab.routeName"
            :to="{ name: tab.routeName }"
            class="rounded-lg text-gray-700 px-3 h-8 leading-8 hover:bg-gray-200 transition-all"
            active-class="bg-gray-100"
          >
            {{ tab.label }}
          </router-link>
        </nav>
        <a-input-search
          v-model="searchWord"
          placeholder="Search by keyword"
          aria-label="Search personal space"
          class="w-[240px] bg-white rounded-lg border-gray-300"
          @search="search"
          @press-enter="search(searchWord)"
        />
      </div>
    </div>
    <!-- Active section -->
    <router-view />
  </div>
</template>
