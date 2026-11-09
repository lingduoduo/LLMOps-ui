<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const createType = ref<string>('')
const queryWord = () => (typeof route.query.search_word === 'string' ? route.query.search_word : '')
const searchWord = ref(queryWord())

// Search event bound to the input box; an empty term clears the query
const search = (value: string) => {
  const term = value.trim()
  void router.push({ path: route.path, query: term ? { search_word: term } : {} })
}

// Update the value of createType
const updateCreateType = (value: string) => {
  createType.value = value
}

// Watch search_word in the route
watch(
  () => route.query.search_word,
  () => {
    searchWord.value = queryWord()
  },
)

// Other pages (e.g. the tool marketplace) ask for a create dialog with `?create=<type>`;
// hand it to the child page as createType and drop it from the URL
watch(
  () => route.query.create,
  (create) => {
    if (typeof create !== 'string' || !create) return
    createType.value = create
    const query = { ...route.query }
    delete query.create
    void router.replace({ query })
  },
  { immediate: true },
)
</script>

<template>
  <div class="px-6 flex flex-col overflow-hidden h-full">
    <div class="pt-6 sticky top-0 z-20 bg-white">
      <!-- Top title + create button -->
      <div class="flex items-center justify-between mb-6">
        <!-- Left title -->
        <div class="flex items-center gap-2">
          <a-avatar :size="32" class="bg-blue-700">
            <icon-user :size="18" />
          </a-avatar>
          <h1 class="text-lg font-medium text-gray-900">Personal Space</h1>
        </div>
        <!-- Create buttons -->
        <a-button
          v-if="route.path.startsWith('/space/apps')"
          type="primary"
          class="rounded-lg"
          @click="router.push({ name: 'space-apps-create' })"
        >
          Create AI App
        </a-button>
        <a-button
          v-if="route.path.startsWith('/space/tools')"
          type="primary"
          class="rounded-lg"
          @click="createType = 'tool'"
        >
          Create Custom Tool
        </a-button>
        <a-button
          v-if="route.path.startsWith('/space/workflows')"
          type="primary"
          class="rounded-lg"
        >
          Create Workflow
        </a-button>
        <a-button v-if="route.path.startsWith('/space/datasets')" type="primary" class="rounded-lg">
          Create Knowledge Base
        </a-button>
      </div>
      <!-- Navigation + search box -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <!-- Left navigation -->
        <nav aria-label="Personal space sections" class="flex items-center gap-2">
          <router-link
            to="/space/apps"
            class="rounded-lg text-gray-700 px-3 h-8 leading-8 hover:bg-gray-200 transition-all"
            active-class="bg-gray-100"
          >
            AI Apps
          </router-link>
          <router-link
            to="/space/tools"
            class="rounded-lg text-gray-700 px-3 h-8 leading-8 hover:bg-gray-200 transition-all"
            active-class="bg-gray-100"
          >
            Tools
          </router-link>
          <router-link
            to="/space/workflows"
            class="rounded-lg text-gray-700 px-3 h-8 leading-8 hover:bg-gray-200 transition-all"
            active-class="bg-gray-100"
          >
            Workflows
          </router-link>
          <router-link
            to="/space/datasets"
            class="rounded-lg text-gray-700 px-3 h-8 leading-8 hover:bg-gray-200 transition-all"
            active-class="bg-gray-100"
          >
            Knowledge Bases
          </router-link>
        </nav>
        <!-- Right search -->
        <a-input-search
          v-model="searchWord"
          placeholder="Enter a keyword to search"
          aria-label="Search personal space"
          class="w-[240px] bg-white rounded-lg border-gray-300"
          @search="search"
          @press-enter="search(searchWord)"
        />
      </div>
    </div>
    <!-- Main content -->
    <router-view :create-type="createType" @update-create-type="updateCreateType" />
  </div>
</template>

<style scoped></style>
