<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DEV_LOGIN_ENABLED, passwordLogin } from '@/services/auth'
import { useAccountStore } from '@/stores/account'
import { clearCredential } from '@/utils/auth'

// Defined in script so production builds drop the text along with the dev login.
const devHint = import.meta.env.DEV ? 'Dev mode: sign in with username admin, password admin.' : ''
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
    const target =
      typeof redirect === 'string' && redirect.startsWith('/') ? router.resolve(redirect) : null
    const destination =
      target && target.matched.length && !target.meta.public ? target.fullPath : '/space/apps'
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
  <main class="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
    <div class="w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-sm p-8">
      <h1 class="text-2xl font-semibold text-gray-900 mb-1">Sign in to LLMOps</h1>
      <p class="text-sm text-gray-500 mb-6">Use your account email and password.</p>
      <p
        v-if="devHint"
        class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-6"
      >
        {{ devHint }}
      </p>
      <form class="flex flex-col" @submit.prevent="login">
        <label for="email" class="text-sm font-medium text-gray-700 mb-1">
          {{ DEV_LOGIN_ENABLED ? 'Email or username' : 'Email' }}
        </label>
        <input
          id="email"
          v-model="email"
          :type="DEV_LOGIN_ENABLED ? 'text' : 'email'"
          autocomplete="username"
          required
          maxlength="254"
          class="border border-gray-300 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
        />
        <label for="password" class="text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="border border-gray-300 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
        />
        <p v-if="error" role="alert" class="text-sm text-red-700 mb-4">{{ error }}</p>
        <button
          type="submit"
          :disabled="isLoading"
          class="bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-md px-4 py-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isLoading ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  </main>
</template>
