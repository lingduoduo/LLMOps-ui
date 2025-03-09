<script setup lang="ts">
import { post } from '@/utils/request'

// Function to send a debug request
async function debug() {
  try {
    const response = await post('/apps/e0d13c78-870b-46df-b2f5-693ae9d5d727/debug', {
      body: { query: 'Hello, who are you?' }, // Example query payload
    })
    console.log('Response received:', response)
  } catch (error) {
    console.error('Failed to send request:', error)
  }
}
</script>

<template>
  <a-button @click="debug">Send Request</a-button>
  <!-- Trigger the debug request -->
</template>

<style scoped></style>
