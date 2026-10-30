<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Avatar as AAvatar, Button as AButton } from '@arco-design/web-vue'
import { IconApps, IconEmpty, IconLoading, IconSend } from '@arco-design/web-vue/es/icon'
import DraftConfigPanel from '@/components/DraftConfigPanel.vue'
import { clearDebugConversation, debugApp, stopDebugChat } from '@/services/app'

type ChatMessage = { id: number; role: 'human' | 'ai'; content: string }
const query = ref('')
const messages = ref<ChatMessage[]>([])
const isLoading = ref(false)
const error = ref('')
const isClearing = ref(false)
const isConfigSaving = ref(false)
const route = useRoute()
let nextMessageId = 0
let activeRequest: AbortController | undefined
let clearRequest: AbortController | undefined
let activeTask: { appId: string; taskId: string } | undefined

const cancelRequest = () => {
  const task = activeTask
  activeTask = undefined
  if (task) void stopDebugChat(task.appId, task.taskId).catch(() => {})
  activeRequest?.abort()
  activeRequest = undefined
  isLoading.value = false
}

const resetPreview = () => {
  clearRequest?.abort()
  clearRequest = undefined
  isClearing.value = false
  cancelRequest()
  messages.value = []
  error.value = ''
}

watch(
  () => route.params.app_id,
  () => {
    resetPreview()
    query.value = ''
  },
)
onBeforeUnmount(() => {
  cancelRequest()
  clearRequest?.abort()
  clearRequest = undefined
})

const clearMessages = async () => {
  cancelRequest()
  clearRequest?.abort()
  error.value = ''
  const controller = new AbortController()
  clearRequest = controller
  isClearing.value = true
  try {
    await clearDebugConversation(String(route.params.app_id), controller.signal)
    if (clearRequest === controller) {
      messages.value = []
      query.value = ''
    }
  } catch (cause) {
    if (clearRequest === controller) {
      error.value =
        cause instanceof Error ? cause.message : 'Unable to reset the backend conversation.'
    }
  } finally {
    if (clearRequest === controller) {
      clearRequest = undefined
      isClearing.value = false
    }
  }
}

const send = async () => {
  if (isLoading.value || isClearing.value || isConfigSaving.value) return
  const humanQuery = query.value.trim()
  if (!humanQuery) {
    error.value = 'User question cannot be empty'
    return
  }

  const controller = new AbortController()
  activeRequest = controller
  const humanMessage = { id: nextMessageId++, role: 'human' as const, content: humanQuery }
  messages.value.push(humanMessage)
  query.value = ''
  error.value = ''
  isLoading.value = true

  let aiMessageId: number | undefined
  try {
    const appId = String(route.params.app_id)
    const response = await debugApp(appId, humanQuery, controller.signal, (event, data) => {
      if (activeRequest !== controller) return
      if (typeof data.task_id === 'string' && data.task_id)
        activeTask = { appId, taskId: data.task_id }
      if (event !== 'agent_message' || typeof data.answer !== 'string' || !data.answer) return
      if (aiMessageId === undefined) {
        aiMessageId = nextMessageId++
        messages.value.push({ id: aiMessageId, role: 'ai', content: '' })
      }
      const message = messages.value.find((item) => item.id === aiMessageId)
      if (message) message.content += data.answer
    })
    if (activeRequest !== controller) return
    if (aiMessageId === undefined) {
      messages.value.push({ id: nextMessageId++, role: 'ai', content: response.data.content })
    }
  } catch (cause) {
    if (activeRequest !== controller) return
    error.value =
      cause instanceof Error ? cause.message : 'Unable to send the message. Please try again.'
    if (aiMessageId === undefined)
      messages.value = messages.value.filter((message) => message.id !== humanMessage.id)
    if (!query.value) query.value = humanQuery
  } finally {
    if (activeRequest === controller) {
      activeRequest = undefined
      activeTask = undefined
      isLoading.value = false
    }
  }
}
</script>

<template>
  <!-- Outer container that fills the entire viewport -->
  <div class="min-h-screen">
    <!-- Top Navigation -->
    <header class="flex items-center h-[74px] bg-gray-100 border-b border-gray-200 px-4">
      Application {{ route.params.app_id }}
    </header>

    <!-- Main content area -->
    <div class="flex flex-col lg:flex-row min-h-[calc(100vh-130px)]">
      <!-- Left Side: App Configuration -->
      <div class="lg:w-1/2 bg-gray-50 p-6">
        <header class="flex items-center h-16 border-b border-gray-200 px-7 text-xl text-gray-700">
          App Configuration
        </header>
        <DraftConfigPanel
          :app-id="String(route.params.app_id)"
          :disabled="isLoading || isClearing"
          @saving="isConfigSaving = $event"
        />
        <p class="py-4 text-gray-600 text-sm">
          The backend maintains conversation context. Clear conversation resets that context.
        </p>
        <router-link class="text-blue-700 underline" to="/space/apps"
          >Choose another application</router-link
        >
      </div>

      <!-- Right Side: Debug & Preview -->
      <div class="flex flex-col lg:w-1/2 bg-white h-[calc(100dvh-130px)] min-h-[420px]">
        <!-- Debug & Preview Header -->
        <header
          class="flex flex-shrink-0 items-center h-16 px-4 text-xl bg-white border-b border-gray-200 shadow-sm"
        >
          Debug & Preview
        </header>

        <!-- Chat Message Interface -->
        <div
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          class="flex-1 min-h-0 px-6 py-7 overflow-x-hidden overflow-y-auto"
        >
          <!-- User Message -->
          <div class="flex flex-row gap-2 mb-6" v-for="message in messages" :key="message.id">
            <!-- Avatar for Human -->
            <a-avatar
              v-if="message.role === 'human'"
              :style="{ backgroundColor: '#3370ff' }"
              class="flex-shrink-0"
              :size="30"
            >
              You
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
                {{ message.role === 'human' ? 'You' : 'Assistant' }}
              </div>
              <div
                v-if="message.role === 'human'"
                :data-role="message.role"
                class="whitespace-pre-wrap break-words max-w-max bg-blue-700 text-white border border-blue-800 px-4 py-3 rounded-2xl leading-5"
              >
                {{ message.content }}
              </div>
              <div
                v-else
                :data-role="message.role"
                class="whitespace-pre-wrap break-words max-w-max bg-gray-100 text-gray-900 border border-gray-200 px-4 py-3 rounded-2xl leading-5"
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
            <div class="text-2xl font-semibold text-gray-900">Application preview</div>
          </div>

          <!-- AI Loading State -->
          <div v-if="isLoading" class="flex flex-row gap-2 mb-6">
            <a-avatar :style="{ backgroundColor: '#00d0b6' }" class="flex-shrink-0" :size="30">
              <icon-apps />
            </a-avatar>
            <div class="flex flex-col gap-2">
              <div class="font-semibold text-gray-700">Assistant</div>
              <div
                class="whitespace-pre-wrap break-words max-w-max bg-gray-100 text-gray-900 border border-gray-200 px-4 py-3 rounded-2xl leading-5"
              >
                <icon-loading />
              </div>
            </div>
          </div>
        </div>

        <!-- Input Area -->
        <div class="w-full flex-shrink-0 flex flex-col">
          <p v-if="error" role="alert" class="px-6 py-3 text-red-700">{{ error }}</p>
          <div class="px-6 flex items-center gap-4">
            <!-- Clear Button -->
            <a-button
              class="flex-shrink-0"
              type="text"
              shape="circle"
              aria-label="Clear conversation"
              :disabled="isClearing"
              @click="clearMessages"
            >
              <template #icon>
                <icon-empty size="16" :style="{ color: '#374151' }" />
              </template>
            </a-button>

            <!-- Input Box -->
            <div
              class="h-[50px] flex items-center gap-2 px-4 flex-1 border border-gray-200 rounded-full"
            >
              <input
                type="text"
                aria-label="Question"
                class="min-w-0 flex-1 outline-0"
                v-model="query"
                @keyup.enter="!$event.isComposing && send()"
              />
              <a-button
                type="text"
                shape="circle"
                aria-label="Send message"
                :disabled="isLoading || isClearing || isConfigSaving"
                @click="send"
              >
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
