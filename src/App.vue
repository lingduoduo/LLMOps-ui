<script setup lang="ts">
import enUS from '@arco-design/web-vue/es/locale/lang/en-us'
</script>

<template>
  <!-- Show Arco's built-in text (confirm buttons, empty states, upload hints) in English -->
  <a-config-provider :locale="enUS">
    <router-view />
  </a-config-provider>
</template>

<style scoped></style>
