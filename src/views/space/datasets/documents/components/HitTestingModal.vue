<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import moment from 'moment'
import { getDatasetQueries, hit } from '@/services/dataset'
import type { GetDatasetQueriesResponse, HitResponse } from '@/models/dataset'

// 1. Define the component props and the v-model visible state
const props = defineProps<{ dataset_id: string; visible: boolean }>()
const emits = defineEmits(['update:visible'])
const retrievalStrategies = [
  { value: 'semantic', label: 'Semantic search' },
  { value: 'full_text', label: 'Full-text search' },
  { value: 'hybrid', label: 'Hybrid search' },
]
const loading = ref(false)
const form = reactive({ query: '', retrieval_strategy: 'semantic', k: 4, score: 0.5 })
const segments = ref<HitResponse['data']>([])
const queries = ref<GetDatasetQueriesResponse['data']>([])

// 2. Load the recent query records
const loadQueries = async () => {
  const resp = await getDatasetQueries(props.dataset_id)
  queries.value = resp.data
}

// 3. Run the retrieval test, then refresh the recent queries
const handleHit = async () => {
  if (!form.query.trim()) return
  try {
    loading.value = true
    const resp = await hit(props.dataset_id, { ...form, query: form.query.trim() })
    segments.value = resp.data
    await loadQueries()
  } finally {
    loading.value = false
  }
}

// 4. Close the modal and clear the last results
const handleCancel = () => {
  form.query = ''
  segments.value = []
  emits('update:visible', false)
}

// 5. Load the recent queries each time the modal opens
watch(
  () => props.visible,
  async (visible) => {
    if (visible) await loadQueries()
  },
)
</script>

<template>
  <a-modal
    :width="960"
    :visible="props.visible"
    hide-title
    :footer="false"
    modal-class="rounded-xl"
    @cancel="handleCancel"
  >
    <!-- Top title -->
    <div class="flex items-center justify-between mb-6">
      <div class="text-lg font-bold text-gray-700">Retrieval Test</div>
      <a-button type="text" class="!text-gray-700" size="small" @click="handleCancel">
        <template #icon>
          <icon-close />
        </template>
      </a-button>
    </div>
    <div class="flex gap-6">
      <!-- Left: query, retrieval settings and recent queries -->
      <div class="flex flex-col w-[360px] flex-shrink-0 gap-4">
        <a-textarea
          id="hit-query"
          v-model="form.query"
          :max-length="200"
          show-word-limit
          :auto-size="{ minRows: 4, maxRows: 4 }"
          placeholder="Enter the text to test retrieval with"
        />
        <a-form :model="form" layout="vertical" size="small">
          <a-form-item field="retrieval_strategy" label="Retrieval strategy">
            <a-radio-group v-model="form.retrieval_strategy">
              <a-radio
                v-for="strategy in retrievalStrategies"
                :key="strategy.value"
                :value="strategy.value"
              >
                {{ strategy.label }}
              </a-radio>
            </a-radio-group>
          </a-form-item>
          <a-form-item field="k" label="Max hits">
            <a-slider v-model="form.k" :min="1" :max="10" show-input />
          </a-form-item>
          <a-form-item field="score" label="Score threshold">
            <a-slider v-model="form.score" :min="0" :max="0.99" :step="0.01" show-input />
          </a-form-item>
        </a-form>
        <a-button
          type="primary"
          class="rounded-lg"
          :loading="loading"
          :disabled="!form.query.trim()"
          @click="handleHit"
        >
          Test
        </a-button>
        <div class="text-gray-700 font-bold">Recent queries</div>
        <div v-if="queries.length === 0" class="text-gray-400 text-xs">No queries yet.</div>
        <div
          v-for="query in queries"
          :key="query.id"
          class="flex items-center justify-between gap-2 text-xs text-gray-500 cursor-pointer hover:text-gray-700"
          @click="form.query = query.query"
        >
          <div class="line-clamp-1">{{ query.query }}</div>
          <div class="flex-shrink-0">
            {{ moment(query.created_at * 1000).format('MM-DD HH:mm') }}
          </div>
        </div>
      </div>
      <!-- Right: retrieved segments -->
      <div class="flex-1 flex flex-col gap-3 max-h-[560px] overflow-y-auto">
        <a-empty v-if="segments.length === 0" description="Run a test to see the hit segments." />
        <div
          v-for="segment in segments"
          :key="segment.id"
          class="segment p-4 bg-gray-50 rounded-lg border border-gray-200"
        >
          <div class="flex items-center justify-between mb-2 text-xs text-gray-500">
            <div>#{{ segment.position }} · {{ segment.document.name }}</div>
            <a-tag size="small" color="blue">Score {{ segment.score.toFixed(2) }}</a-tag>
          </div>
          <div class="text-gray-700 text-sm line-clamp-4">{{ segment.content }}</div>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style scoped></style>
