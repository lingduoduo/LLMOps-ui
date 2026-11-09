<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const createType = ref<string>('')
const searchWord = ref(route.query?.search_word || '')

// Search event bound to the input box
const search = (value: string) => {
  router.push({
    path: route.path,
    query: {
      search_word: value,
    },
  })
}

// Update the value of createType
const updateCreateType = (value: string) => {
  createType.value = value
}

// Watch search_word in the route
watch(
  () => route.query?.search_word,
  () => {
    searchWord.value = route.query?.search_word || ''
  },
)
</script>

<template>
  <!-- Adjust the padding + hide overflow -->
  <div class="px-6 flex flex-col overflow-hidden h-full">
    <div class="pt-6 sticky top-0 z-20 bg-gray-50">
      <!-- Top title + create button -->
      <div class="flex items-center justify-between mb-6">
        <!-- Left title -->
        <div class="flex items-center gap-2">
          <a-avatar :size="32" class="bg-blue-700">
            <icon-user :size="18" />
          </a-avatar>
          <div class="text-lg font-medium text-gray-900">Personal Space</div>
        </div>
        <!-- Create buttons -->
        <a-button v-if="route.path.startsWith('/space/apps')" type="primary" class="rounded-lg">
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
      <!-- Navigation buttons + search box -->
      <div class="flex items-center justify-between mb-6">
        <!-- Left navigation -->
        <div class="flex items-center gap-2">
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
        </div>
        <!-- Right search -->
        <a-input-search
          v-model="searchWord"
          placeholder="Enter a keyword to search"
          class="w-[240px] bg-white rounded-lg border-gray-300"
          @search="search"
        />
      </div>
    </div>
    <!-- Main content -->
    <router-view :create-type="createType" @update-create-type="updateCreateType" />
  </div>
</template>

<style scoped></style>
