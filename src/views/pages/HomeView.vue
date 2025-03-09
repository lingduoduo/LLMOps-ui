<script setup lang="ts">
import { useAccountStore } from '@/stores/account'

const accountStore = useAccountStore()

function updateName() {
  accountStore.update({ name: 'Little Class' })
}
</script>

<template>
  <p>This is the homepage</p>
  <p>Currently logged-in account: {{ accountStore.account.name }}</p>
  <p>Currently logged-in email: {{ accountStore.account.email }}</p>
  <a-button type="primary" @click="updateName">Update Name</a-button>
  <a-button @click="accountStore.clear">Reset</a-button>
  <router-link to="/space/apps">Go to Application List</router-link>
</template>

<style scoped></style>
