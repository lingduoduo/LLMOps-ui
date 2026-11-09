<script setup lang="ts">
import { typeMap } from '@/config'
import { pluralize } from '@/utils/format'

// Tool cards shown in a provider's details drawer, with each tool's parameters.
defineProps<{
  tools: {
    name: string
    label?: string
    description: string
    inputs?: { name: string; type: string; description: string; required: boolean }[]
  }[]
}>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="text-xs text-gray-500">Includes {{ pluralize(tools.length, 'tool') }}</div>
    <a-card v-for="tool in tools" :key="tool.name" class="flex flex-col rounded-xl">
      <!-- Tool name and description -->
      <div class="font-bold text-gray-900 mb-2">{{ tool.label || tool.name }}</div>
      <div class="text-gray-500 text-xs">{{ tool.description }}</div>
      <!-- Tool parameters -->
      <div v-if="tool.inputs?.length">
        <div class="flex items-center gap-2 my-4">
          <div class="text-xs font-bold text-gray-500">Parameters</div>
          <hr class="flex-1 border-gray-200" />
        </div>
        <div class="flex flex-col gap-4">
          <div v-for="input in tool.inputs" :key="input.name" class="flex flex-col gap-2">
            <div class="flex items-center gap-2 text-xs">
              <div class="text-gray-900 font-bold">{{ input.name }}</div>
              <div class="text-gray-500">{{ typeMap[input.type] || input.type }}</div>
              <div v-if="input.required" class="text-red-700">Required</div>
            </div>
            <div class="text-xs text-gray-500">{{ input.description }}</div>
          </div>
        </div>
      </div>
    </a-card>
  </div>
</template>
