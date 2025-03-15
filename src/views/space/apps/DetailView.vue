<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { debugApp } from '@/services/app'

// 1. User query input
const query = ref('')
// 2. List of messages for chat display (both human and AI)
const messages = ref<any[]>([])
// 3. Loading state to prevent multiple requests
const isLoading = ref(false)
const route = useRoute()

// Clear all messages from the chat
const clearMessages = () => {
  messages.value = []
}

// Send user query to the backend and display the response
const send = async () => {
  // 1. Check if query is empty
  if (!query.value) {
    Message.error('User question cannot be empty')
    return
  }
  // 2. Prevent sending another query while waiting for the previous response
  if (isLoading.value) {
    Message.warning('The previous response has not yet finished, please wait')
    return
  }

  try {
    // 3. Push user's query to the messages list
    const humanQuery = query.value
    messages.value.push({
      role: 'human',
      content: humanQuery,
    })
    query.value = ''
    isLoading.value = true

    // 4. Call the backend API and push the AI response to the messages list
    const response = await debugApp(route.params.app_id as string, humanQuery)
    const content = response.data.content

    messages.value.push({
      role: 'ai',
      content: content,
    })
  } finally {
    // 5. Ensure loading state is reset
    isLoading.value = false
  }
}
</script>

<template>
  <!-- Outer container that fills the entire viewport -->
  <div class="min-h-screen">
    <!-- Top Navigation -->
    <header class="flex items-center h-[74px] bg-gray-100 border-b border-gray-200 px-4">
      Top Navigation
    </header>

    <!-- Main content area -->
    <div class="flex flex-row h-[calc(100vh-74px)]">
      <!-- Left Side: App Configuration -->
      <div class="w-2/3 bg-gray-50 h-full">
        <header class="flex items-center h-16 border-b border-gray-200 px-7 text-xl text-gray-700">
          App Configuration
        </header>
        <div class="flex flex-row h-[calc(100%-64px)]">
          <div class="flex-1 border-r border-gray-200 p-6">Character & Reply Logic</div>
          <div class="flex-1 p-6">App Capabilities</div>
        </div>
      </div>

      <!-- Right Side: Debug & Preview -->
      <div class="flex flex-col w-1/3 bg-white h-full">
        <!-- Debug & Preview Header -->
        <header
          class="flex flex-shrink-0 items-center h-16 px-4 text-xl bg-white border-b border-gray-200 shadow-sm"
        >
          Debug & Preview
        </header>

        <!-- Chat Message Interface -->
        <div class="h-full min-h-0 px-6 py-7 overflow-x-hidden overflow-y-scroll scrollbar-w-none">
          <!-- User Message -->
          <div class="flex flex-row gap-2 mb-6" v-for="message in messages" :key="message.content">
            <!-- Avatar for Human -->
            <a-avatar
              v-if="message.role === 'human'"
              :style="{ backgroundColor: '#3370ff' }"
              class="flex-shrink-0"
              :size="30"
            >
              Ling
            </a-avatar>
            <!-- Avatar for AI -->
            <a-avatar
              v-else
              :style="{ backgroundColor: '#00d0b6' }"
              class="flex-shrink-0"
              :size="30"
            >
              <icon-apps />
            </a-avatar>

            <!-- Message Content -->
            <div class="flex flex-col gap-2">
              <div class="font-semibold text-gray-700">
                {{ message.role === 'human' ? 'Ling' : 'GPT bot' }}
              </div>
              <div
                v-if="message.role === 'human'"
                class="max-w-max bg-blue-700 text-white border border-blue-800 px-4 py-3 rounded-2xl leading-5"
              >
                {{ message.content }}
              </div>
              <div
                v-else
                class="max-w-max bg-gray-100 text-gray-900 border border-gray-200 px-4 py-3 rounded-2xl leading-5"
              >
                {{ message.content }}
              </div>
            </div>
          </div>

          <!-- No Data Message -->
          <div
            v-if="!messages.length"
            class="mt-[200px] flex flex-col items-center justify-center gap-2"
          >
            <a-avatar :size="70" shape="square" :style="{ backgroundColor: '#00d0b6' }">
              <icon-apps />
            </a-avatar>
            <div class="text-2xl font-semibold text-gray-900">GPT Chatbot</div>
          </div>

          <!-- AI Loading State -->
          <div v-if="isLoading" class="flex flex-row gap-2 mb-6">
            <a-avatar :style="{ backgroundColor: '#00d0b6' }" class="flex-shrink-0" :size="30">
              <icon-apps />
            </a-avatar>
            <div class="flex flex-col gap-2">
              <div class="font-semibold text-gray-700">GPT bot</div>
              <div
                class="max-w-max bg-gray-100 text-gray-900 border border-gray-200 px-4 py-3 rounded-2xl leading-5"
              >
                <icon-loading />
              </div>
            </div>
          </div>
        </div>

        <!-- Input Area -->
        <div class="w-full flex-shrink-0 flex flex-col">
          <div class="px-6 flex items-center gap-4">
            <!-- Clear Button -->
            <a-button class="flex-shrink-0" type="text" shape="circle" @click="clearMessages">
              <template #icon>
                <icon-empty size="16" :style="{ color: '#374151' }" />
              </template>
            </a-button>

            <!-- Input Box -->
            <div
              class="h-[50px] flex items-center gap-2 px-4 flex-1 border border-gray-200 rounded-full"
            >
              <input type="text" class="flex-1 outline-0" v-model="query" @keyup.enter="send" />
              <a-button type="text" shape="circle">
                <template #icon>
                  <icon-plus-circle size="16" :style="{ color: '#374151' }" />
                </template>
              </a-button>
              <a-button type="text" shape="circle" @click="send">
                <template #icon>
                  <icon-send size="16" :style="{ color: '#1d4ed8' }" />
                </template>
              </a-button>
            </div>
          </div>

          <!-- Footer Message -->
          <div class="text-center text-gray-500 text-xs py-4">
            Content is AI-generated and may not be accurate. For reference only.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
