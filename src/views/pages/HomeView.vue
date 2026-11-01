<script setup lang="ts">
import { useAccountStore } from '@/stores/account'

// The route guard loads the account before this page renders; the layout reports load errors.
const accountStore = useAccountStore()
</script>

<template>
  <main class="max-w-2xl mx-auto px-6 py-12">
    <h1 class="text-3xl font-semibold mb-4">LLMOps application preview</h1>
    <section aria-label="Signed-in account" class="flex items-center gap-4 rounded border p-4 mb-6">
      <template v-if="accountStore.account">
        <a-avatar :size="48" :image-url="accountStore.account.avatar || undefined">
          <icon-user v-if="!accountStore.account.avatar" />
        </a-avatar>
        <div>
          <p class="font-medium">Signed in as {{ accountStore.account.name }}</p>
          <p class="text-sm text-gray-600">{{ accountStore.account.email }}</p>
        </div>
      </template>
      <p v-else class="text-gray-600">Account details are unavailable.</p>
    </section>
    <p class="text-gray-600 mb-6">
      Select an application from your account and test its responses in a debug conversation.
    </p>
    <router-link to="/space/apps" class="inline-block rounded bg-blue-700 text-white px-4 py-2">
      Open an application
    </router-link>
  </main>
</template>
