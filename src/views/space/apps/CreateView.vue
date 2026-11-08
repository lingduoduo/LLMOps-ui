<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createApp } from '@/services/app'

const router = useRouter()
const form = reactive({ name: '', icon: '', description: '' })
const error = ref('')
const isSaving = ref(false)
let activeRequest: AbortController | undefined
onBeforeUnmount(() => {
  activeRequest?.abort()
  activeRequest = undefined
})
const save = async () => {
  if (isSaving.value) return
  error.value = ''
  const payload = {
    name: form.name.trim(),
    icon: form.icon.trim(),
    description: form.description.trim(),
  }
  if (!payload.name || payload.name.length > 40) {
    error.value = 'Enter an application name of up to 40 characters.'
    return
  }
  try {
    const iconUrl = new URL(payload.icon)
    if (!['http:', 'https:'].includes(iconUrl.protocol)) throw new Error('Invalid URL')
  } catch {
    error.value = 'Enter a valid HTTP or HTTPS image URL for the application icon.'
    return
  }
  if (payload.description.length > 800) {
    error.value = 'The description cannot exceed 800 characters.'
    return
  }
  const controller = new AbortController()
  activeRequest = controller
  isSaving.value = true
  try {
    const app = await createApp(payload, controller.signal)
    if (activeRequest !== controller) return
    await router.push({ name: 'space-apps-detail', params: { app_id: app.id } })
  } catch (cause) {
    if (activeRequest === controller)
      error.value = cause instanceof Error ? cause.message : 'Unable to create the application.'
  } finally {
    if (activeRequest === controller) {
      activeRequest = undefined
      isSaving.value = false
    }
  }
}
</script>

<template>
  <main class="mx-auto max-w-2xl px-6 py-12">
    <router-link to="/space/apps" class="text-sm text-blue-700 underline"
      >Back to applications</router-link
    >
    <h1 class="mt-4 mb-3 text-2xl font-semibold">Create AI Application</h1>
    <p class="mb-6 text-gray-600">
      Create an application, then configure its instructions and test it in the editor.
    </p>
    <form aria-label="Create application" class="flex flex-col gap-5" @submit.prevent="save">
      <fieldset :disabled="isSaving" class="flex flex-col gap-5">
        <label for="app-name" class="flex flex-col gap-2 text-sm font-medium"
          >Name
          <input
            id="app-name"
            v-model="form.name"
            required
            maxlength="40"
            autocomplete="off"
            class="rounded border border-gray-300 px-3 py-2"
            placeholder="Research assistant"
          />
        </label>
        <label for="app-icon" class="flex flex-col gap-2 text-sm font-medium"
          >Icon URL
          <input
            id="app-icon"
            v-model="form.icon"
            required
            type="url"
            class="rounded border border-gray-300 px-3 py-2"
            placeholder="https://example.com/icon.png"
          />
          <span class="font-normal text-gray-500"
            >Use an image URL accessible to your application server.</span
          >
        </label>
        <label for="app-description" class="flex flex-col gap-2 text-sm font-medium"
          >Description (optional)
          <textarea
            id="app-description"
            v-model="form.description"
            rows="4"
            maxlength="800"
            class="rounded border border-gray-300 px-3 py-2"
            placeholder="What does this application do?"
          />
        </label>
      </fieldset>
      <p v-if="error" role="alert" class="text-red-700">{{ error }}</p>
      <button
        type="submit"
        :disabled="isSaving"
        class="self-start rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
      >
        {{ isSaving ? 'Creating application…' : 'Create application' }}
      </button>
    </form>
  </main>
</template>
