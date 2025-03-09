<script setup lang="ts">
import { useCounterStore } from '@/stores/counter'

const counterStore = useCounterStore()
</script>

<template>
  <p>This is the AI application list</p>
  <p>The value is: {{ counterStore.count }}</p>
  <router-link to="/home">Return to Home</router-link>
</template>

<style scoped></style>
