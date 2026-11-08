<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Avatar as AAvatar } from '@arco-design/web-vue'
import { IconPoweroff } from '@arco-design/web-vue/es/icon'
import IconHome from '@/components/icons/IconHome.vue'
import IconHomeFull from '@/components/icons/IconHomeFull.vue'
import IconSpace from '@/components/icons/IconSpace.vue'
import IconSpaceFull from '@/components/icons/IconSpaceFull.vue'
import IconApp from '@/components/icons/IconApp.vue'
import IconAppFull from '@/components/icons/IconAppFull.vue'
import IconTool from '@/components/icons/IconTool.vue'
import IconToolFull from '@/components/icons/IconToolFull.vue'
import { logout } from '@/services/auth'
import { useAccountStore } from '@/stores/account'
import { clearCredential, SESSION_CLEARED_EVENT } from '@/utils/auth'

const route = useRoute()
const accountStore = useAccountStore()
const error = ref('')
const isLoadingAccount = ref(false)
const isLoggingOut = ref(false)
const accountInitial = computed(
  () => accountStore.account?.name.trim().charAt(0).toUpperCase() || 'U',
)
const navigationGroups = [
  {
    label: 'Workspace',
    items: [
      { to: '/home', label: 'Home', icon: IconHome, activeIcon: IconHomeFull },
      { to: '/space/apps', label: 'Personal Space', icon: IconSpace, activeIcon: IconSpaceFull },
    ],
  },
  {
    label: 'Explore',
    items: [
      { to: '/store/apps', label: 'App Marketplace', icon: IconApp, activeIcon: IconAppFull },
      { to: '/store/tools', label: 'Tool Marketplace', icon: IconTool, activeIcon: IconToolFull },
    ],
  },
]
const isActive = (path: string) => route.path === path || route.path.startsWith(`${path}/`)
let mounted = true
const clearAccount = () => accountStore.clear()
window.addEventListener(SESSION_CLEARED_EVENT, clearAccount)
onBeforeUnmount(() => {
  mounted = false
  window.removeEventListener(SESSION_CLEARED_EVENT, clearAccount)
})
const loadAccount = async () => {
  if (accountStore.account || isLoadingAccount.value) return
  isLoadingAccount.value = true
  error.value = ''
  try {
    await accountStore.load()
  } catch (cause) {
    if (mounted)
      error.value = cause instanceof Error ? cause.message : 'Unable to load your account.'
  } finally {
    if (mounted) isLoadingAccount.value = false
  }
}
onMounted(loadAccount)
const signOut = async () => {
  if (isLoggingOut.value) return
  isLoggingOut.value = true
  try {
    await logout()
  } catch {
    // End the local session even when the server is unavailable.
  } finally {
    clearCredential()
    accountStore.clear()
    isLoggingOut.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh bg-white text-gray-900 md:flex">
    <aside
      class="border-b border-gray-200 bg-gray-50 p-2 md:w-60 md:shrink-0 md:border-b-0 md:border-r"
    >
      <div
        class="flex h-full flex-col rounded-lg bg-white px-3 py-5 md:sticky md:top-2 md:h-[calc(100dvh-1rem)]"
      >
        <router-link
          to="/home"
          class="mb-6 rounded px-2 text-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-blue-700"
          >LLMOps UI</router-link
        >
        <nav aria-label="Main navigation" class="flex flex-col gap-5">
          <div v-for="group in navigationGroups" :key="group.label">
            <p class="mb-2 px-2 text-xs font-medium text-gray-500">{{ group.label }}</p>
            <div class="flex flex-wrap gap-1 md:flex-col">
              <router-link
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                :aria-current="isActive(item.to) ? 'page' : undefined"
                :class="[
                  'flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-blue-700',
                  isActive(item.to)
                    ? 'bg-blue-50 font-medium text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
                ]"
              >
                <component
                  :is="isActive(item.to) ? item.activeIcon : item.icon"
                  aria-hidden="true"
                  class="shrink-0"
                />
                {{ item.label }}
              </router-link>
            </div>
          </div>
        </nav>
        <section
          aria-label="Signed-in account"
          class="mt-6 border-t border-gray-100 pt-4 md:mt-auto"
        >
          <div class="flex min-w-0 items-center gap-2 px-1">
            <a-avatar
              :size="32"
              :image-url="accountStore.account?.avatar || undefined"
              class="shrink-0 bg-blue-700 text-sm"
              aria-label="Your avatar"
              >{{ accountInitial }}</a-avatar
            >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium" :title="accountStore.account?.name">
                {{ accountStore.account?.name || 'Your account' }}
              </p>
              <p
                v-if="accountStore.account?.email"
                class="truncate text-xs text-gray-500"
                :title="accountStore.account.email"
              >
                {{ accountStore.account.email }}
              </p>
              <p v-if="isLoadingAccount" role="status" class="text-xs text-gray-500">
                Loading account…
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            :disabled="isLoggingOut"
            class="mt-3 flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-sm text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-50"
            @click="signOut"
          >
            <icon-poweroff aria-hidden="true" />
            {{ isLoggingOut ? 'Signing out…' : 'Sign out' }}
          </button>
        </section>
      </div>
    </aside>
    <div class="min-w-0 flex-1">
      <div
        v-if="error"
        role="alert"
        class="flex flex-wrap items-center gap-2 px-6 py-3 text-sm text-red-700"
      >
        {{ error }}
        <button
          type="button"
          aria-label="Retry loading account"
          :disabled="isLoadingAccount"
          class="underline"
          @click="loadAccount"
        >
          Retry
        </button>
      </div>
      <router-view />
    </div>
  </div>
</template>
