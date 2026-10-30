<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { passwordLogin } from '@/services/auth'
import { useAccountStore } from '@/stores/account'
import { clearCredential } from '@/utils/auth'

const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)
const route = useRoute()
const router = useRouter()
const accountStore = useAccountStore()

const login = async () => {
  if (isLoading.value) return
  error.value = ''
  isLoading.value = true
  try {
    await passwordLogin(email.value.trim(), password.value)
    await accountStore.load()
    password.value = ''
    const redirect = route.query.redirect
    // Only return to protected application routes in this SPA.
    const destination =
      typeof redirect === 'string' && /^\/(?:home|space\/apps)(?:[/?#]|$)/.test(redirect)
        ? redirect
        : '/space/apps'
    await router.replace(destination)
  } catch (cause) {
    clearCredential()
    accountStore.clear()
    error.value = cause instanceof Error ? cause.message : 'Unable to sign in. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <main class="max-w-md mx-auto px-6 py-12">
    <h1 class="text-2xl font-semibold mb-6">Sign in to LLMOps</h1>
    <form class="flex flex-col gap-3" @submit.prevent="login">
      <label for="email">Email</label>
      <input
        id="email"
        v-model="email"
        type="email"
        autocomplete="username"
        required
        maxlength="254"
        class="border rounded px-3 py-2"
      />
      <label for="password">Password</label>
      <input
        id="password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        required
        class="border rounded px-3 py-2"
      />
      <p v-if="error" role="alert" class="text-red-700">{{ error }}</p>
      <button
        type="submit"
        :disabled="isLoading"
        class="bg-blue-700 text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {{ isLoading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </main>
</template>
