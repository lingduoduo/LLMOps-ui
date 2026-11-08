<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useAccountStore } from '@/stores/account'
import { getAccessToken } from '@/utils/auth'
import { isDevSession } from '@/services/auth'
import { updateAccountAvatar, updateAccountName, updateAccountPassword } from '@/services/account'

const store = useAccountStore()
const name = ref('')
const avatar = ref('')
const password = ref('')
const confirmation = ref('')
type Action = 'name' | 'avatar' | 'password'
const pending = reactive({ name: false, avatar: false, password: false })
const errors = reactive({ name: '', avatar: '', password: '' })
const success = reactive({ name: '', avatar: '', password: '' })
const controller = new AbortController()
let active = true
onBeforeUnmount(() => {
  active = false
  controller.abort()
  password.value = ''
  confirmation.value = ''
})
watch(
  () => store.account?.id,
  () => {
    name.value = store.account?.name ?? ''
    avatar.value = store.account?.avatar ?? ''
    password.value = ''
    confirmation.value = ''
  },
  { immediate: true },
)

async function save(action: Action) {
  if (pending[action]) return
  errors[action] = ''
  success[action] = ''
  const value =
    action === 'name'
      ? name.value.trim()
      : action === 'avatar'
        ? avatar.value.trim()
        : password.value
  if (action === 'name' && (value.length < 3 || value.length > 30)) {
    errors.name = 'Name must contain 3–30 characters.'
    return
  }
  if (action === 'avatar') {
    try {
      const url = new URL(value)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    } catch {
      errors.avatar = 'Enter an absolute http or https image URL.'
      return
    }
  }
  if (action === 'password') {
    if (value.length < 8 || value.length > 16 || !/[a-z]/i.test(value) || !/[0-9]/.test(value)) {
      errors.password = 'Password must contain 8–16 characters, including a letter and a number.'
      return
    }
    if (value !== confirmation.value) {
      errors.password = 'Passwords do not match.'
      return
    }
  }
  const accountId = store.account?.id
  const token = getAccessToken()
  if (!accountId) {
    errors[action] = 'Your account is unavailable. Please sign in again.'
    return
  }
  if (isDevSession()) {
    errors[action] =
      'Account changes require a backend account. Sign in with your email to save changes.'
    return
  }
  const current = () => active && store.account?.id === accountId && getAccessToken() === token
  pending[action] = true
  try {
    const mutate = {
      name: updateAccountName,
      avatar: updateAccountAvatar,
      password: updateAccountPassword,
    }[action]
    await mutate(value, controller.signal)
    if (!current()) return
    if (action !== 'password' && store.account)
      store.account = { ...store.account, [action]: value }
    if (action === 'password') {
      password.value = ''
      confirmation.value = ''
    }
    success[action] =
      `${action === 'name' ? 'Name' : action === 'avatar' ? 'Avatar' : 'Password'} saved.`
  } catch (error) {
    if (current())
      errors[action] =
        error instanceof Error ? error.message : 'Unable to save changes. Please try again.'
  } finally {
    if (active) pending[action] = false
  }
}
</script>

<template>
  <main class="h-full overflow-y-auto bg-gray-50 p-6 lg:p-10">
    <div class="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 class="text-2xl font-semibold text-gray-900">Account settings</h1>
        <p class="mt-2 text-sm text-gray-500">Manage your profile and sign-in password.</p>
      </header>
      <section class="rounded-xl border border-gray-200 bg-white p-6">
        <h2 class="mb-5 text-lg font-semibold">Profile</h2>
        <label for="account-email" class="block text-sm font-medium">Email</label>
        <input
          id="account-email"
          :value="store.account?.email ?? ''"
          readonly
          type="email"
          class="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500"
        />
        <p class="mt-2 text-xs text-gray-500">Your email is managed by your sign-in account.</p>
        <form data-test="name-form" class="mt-6 space-y-2" @submit.prevent="save('name')">
          <label for="account-name" class="block text-sm font-medium">Name</label>
          <input
            id="account-name"
            v-model="name"
            required
            minlength="3"
            maxlength="30"
            autocomplete="name"
            class="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          <p v-if="errors.name" role="alert" class="text-sm text-red-600">{{ errors.name }}</p>
          <p v-if="success.name" role="status" class="text-sm text-green-700">{{ success.name }}</p>
          <button
            :disabled="pending.name || !store.account"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {{ pending.name ? 'Saving…' : 'Save name' }}
          </button>
        </form>
        <form data-test="avatar-form" class="mt-6 space-y-2" @submit.prevent="save('avatar')">
          <label for="account-avatar" class="block text-sm font-medium">Avatar URL</label>
          <input
            id="account-avatar"
            v-model="avatar"
            required
            type="url"
            placeholder="https://example.com/avatar.png"
            class="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          <p class="text-xs text-gray-500">Use an absolute URL to an image.</p>
          <p v-if="errors.avatar" role="alert" class="text-sm text-red-600">{{ errors.avatar }}</p>
          <p v-if="success.avatar" role="status" class="text-sm text-green-700">
            {{ success.avatar }}
          </p>
          <button
            :disabled="pending.avatar || !store.account"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {{ pending.avatar ? 'Saving…' : 'Save avatar' }}
          </button>
        </form>
      </section>
      <section class="rounded-xl border border-gray-200 bg-white p-6">
        <h2 class="text-lg font-semibold">Change password</h2>
        <form data-test="password-form" class="mt-5 space-y-3" @submit.prevent="save('password')">
          <label for="password" class="block text-sm font-medium">New password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            minlength="8"
            maxlength="16"
            autocomplete="new-password"
            class="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          <p class="text-xs text-gray-500">8–16 characters, including a letter and a number.</p>
          <label for="confirm-password" class="block text-sm font-medium"
            >Confirm new password</label
          >
          <input
            id="confirm-password"
            v-model="confirmation"
            type="password"
            required
            autocomplete="new-password"
            class="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          <p v-if="errors.password" role="alert" class="text-sm text-red-600">
            {{ errors.password }}
          </p>
          <p v-if="success.password" role="status" class="text-sm text-green-700">
            {{ success.password }}
          </p>
          <button
            :disabled="pending.password || !store.account"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {{ pending.password ? 'Saving…' : 'Save password' }}
          </button>
        </form>
      </section>
    </div>
  </main>
</template>
