<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { logout } from '@/services/auth'
import { useAccountStore } from '@/stores/account'
import { clearCredential, SESSION_CLEARED_EVENT } from '@/utils/auth'

const accountStore = useAccountStore()
const error = ref('')
const isLoggingOut = ref(false)
const clearAccount = () => accountStore.clear()
window.addEventListener(SESSION_CLEARED_EVENT, clearAccount)
onBeforeUnmount(() => window.removeEventListener(SESSION_CLEARED_EVENT, clearAccount))
onMounted(async () => {
  if (accountStore.account) return
  try {
    await accountStore.load()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to load your account.'
  }
})
const signOut = async () => {
  if (isLoggingOut.value) return
  isLoggingOut.value = true
  try {
    await logout()
  } catch {
    /* Local credentials must be removed even when the backend is unavailable. */
  } finally {
    clearCredential()
    accountStore.clear()
    isLoggingOut.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-white text-gray-900">
    <nav aria-label="Main navigation" class="flex flex-wrap items-center gap-6 border-b px-6 py-4">
      <router-link to="/home" class="font-semibold">LLMOps UI</router-link>
      <router-link to="/space/apps" class="text-blue-700 underline">Applications</router-link>
      <span class="text-sm text-gray-500 ml-auto">{{ accountStore.account?.name }}</span>
      <button
        type="button"
        :disabled="isLoggingOut"
        class="text-gray-600 underline"
        @click="signOut"
      >
        Sign out
      </button>
    </nav>
    <p v-if="error" role="alert" class="px-6 py-3 text-red-700">{{ error }}</p>
    <router-view />
  </div>
</template>
