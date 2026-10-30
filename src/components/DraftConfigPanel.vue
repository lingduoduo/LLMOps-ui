<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { get, post } from '@/utils/request'
import type { BaseResponse } from '@/models/base'

type DraftConfig = {
  preset_prompt: string
  dialog_round: number
  model_config?: { provider?: string; model?: string }
  tools?: unknown[]
  datasets?: unknown[]
  workflows?: unknown[]
}
const emit = defineEmits<{ saving: [value: boolean] }>()
const props = defineProps<{ appId: string; disabled?: boolean }>()
const config = ref<DraftConfig | null>(null)
const prompt = ref('')
const rounds = ref(0)
const error = ref('')
const status = ref('')
const isLoading = ref(false)
let activeRequest: AbortController | undefined

const load = async () => {
  emit('saving', false)
  activeRequest?.abort()
  const controller = new AbortController()
  activeRequest = controller
  config.value = null
  error.value = ''
  status.value = ''
  isLoading.value = true
  try {
    const response = await get<BaseResponse<DraftConfig>>(
      `/apps/${encodeURIComponent(props.appId)}/draft-app-config`,
      { signal: controller.signal },
    )
    if (activeRequest !== controller) return
    if (
      !response.data ||
      typeof response.data.preset_prompt !== 'string' ||
      !Number.isInteger(response.data.dialog_round)
    ) {
      throw new Error('The server returned an invalid draft configuration.')
    }
    config.value = response.data
    prompt.value = response.data.preset_prompt
    rounds.value = response.data.dialog_round
  } catch (cause) {
    if (activeRequest === controller)
      error.value = cause instanceof Error ? cause.message : 'Unable to load the draft.'
  } finally {
    if (activeRequest === controller) {
      activeRequest = undefined
      isLoading.value = false
    }
  }
}
watch(() => props.appId, load, { immediate: true })
onBeforeUnmount(() => {
  emit('saving', false)
  activeRequest?.abort()
  activeRequest = undefined
})

const save = async () => {
  if (isLoading.value || props.disabled || !config.value) return
  error.value = ''
  status.value = ''
  if (
    prompt.value.length > 2000 ||
    !Number.isInteger(rounds.value) ||
    rounds.value < 0 ||
    rounds.value > 100
  ) {
    error.value = 'Use a prompt up to 2,000 characters and 0–100 conversation rounds.'
    return
  }
  const controller = new AbortController()
  activeRequest = controller
  isLoading.value = true
  emit('saving', true)
  try {
    await post(`/apps/${encodeURIComponent(props.appId)}/draft-app-config`, {
      body: { preset_prompt: prompt.value, dialog_round: rounds.value },
      signal: controller.signal,
    })
    if (activeRequest === controller)
      status.value = 'Draft saved. The next debug request will use these settings.'
  } catch (cause) {
    if (activeRequest === controller)
      error.value = cause instanceof Error ? cause.message : 'Unable to save the draft.'
  } finally {
    if (activeRequest === controller) {
      activeRequest = undefined
      isLoading.value = false
      emit('saving', false)
    }
  }
}
</script>

<template>
  <section>
    <p v-if="isLoading && !config" role="status" class="py-4">Loading draft configuration…</p>
    <p v-if="error" role="alert" class="py-3 text-red-700">{{ error }}</p>
    <button v-if="!config && !isLoading" type="button" class="underline" @click="load">
      Retry loading configuration
    </button>
    <form v-if="config" class="flex flex-col gap-3 py-6" @submit.prevent="save">
      <label for="preset-prompt" class="font-semibold">Character &amp; reply instructions</label>
      <textarea
        id="preset-prompt"
        v-model="prompt"
        maxlength="2000"
        rows="10"
        :disabled="disabled || isLoading"
        class="border rounded p-3 bg-white"
      />
      <label for="dialog-rounds" class="font-semibold">Conversation rounds</label>
      <input
        id="dialog-rounds"
        v-model.number="rounds"
        type="number"
        min="0"
        max="100"
        required
        :disabled="disabled || isLoading"
        class="border rounded p-2 bg-white"
      />
      <button
        type="submit"
        :disabled="disabled || isLoading"
        class="rounded bg-blue-700 text-white px-4 py-2 disabled:opacity-50"
      >
        {{ isLoading ? 'Saving…' : 'Save draft' }}
      </button>
      <p v-if="status" role="status" class="text-green-700">{{ status }}</p>
      <div class="text-gray-600 text-sm">
        <p>Model: {{ config.model_config?.provider }} / {{ config.model_config?.model }}</p>
        <p>
          Tools: {{ config.tools?.length ?? 0 }} · Datasets: {{ config.datasets?.length ?? 0 }} ·
          Workflows: {{ config.workflows?.length ?? 0 }}
        </p>
      </div>
    </form>
  </section>
</template>
