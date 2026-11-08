<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { navigationGroups, sidebarActions } from '@/router/navigation'
import {
  Avatar as AAvatar,
  Button as AButton,
  Dropdown as ADropdown,
  Doption as ADoption,
  Layout as ALayout,
  LayoutSider as ALayoutSider,
  LayoutContent as ALayoutContent,
} from '@arco-design/web-vue'
import { IconPlus, IconPoweroff, IconSettings } from '@arco-design/web-vue/es/icon'
import IconHome from '@/components/icons/IconHome.vue'
import IconHomeFull from '@/components/icons/IconHomeFull.vue'
import IconSpace from '@/components/icons/IconSpace.vue'
import IconSpaceFull from '@/components/icons/IconSpaceFull.vue'
import IconApp from '@/components/icons/IconApp.vue'
import IconAppFull from '@/components/icons/IconAppFull.vue'
import IconTool from '@/components/icons/IconTool.vue'
import IconToolFull from '@/components/icons/IconToolFull.vue'
import IconOpenApi from '@/components/icons/IconOpenApi.vue'
import IconOpenApiFull from '@/components/icons/IconOpenApiFull.vue'
import { logout } from '@/services/auth'
import { useAccountStore } from '@/stores/account'
import { clearCredential, SESSION_CLEARED_EVENT } from '@/utils/auth'

const route = useRoute()
const router = useRouter()
const accountMenuOpen = ref(false)
const accountStore = useAccountStore()
const error = ref('')
const isLoadingAccount = ref(false)
const isLoggingOut = ref(false)
const accountInitial = computed(
  () => accountStore.account?.name.trim().charAt(0).toUpperCase() || 'U',
)
const navigationIcons = {
  home: { icon: IconHome, activeIcon: IconHomeFull },
  space: { icon: IconSpace, activeIcon: IconSpaceFull },
  apps: { icon: IconApp, activeIcon: IconAppFull },
  tools: { icon: IconTool, activeIcon: IconToolFull },
  open: { icon: IconOpenApi, activeIcon: IconOpenApiFull },
}
const isActive = (section: string) => route.meta.navigationSection === section
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
  <a-layout has-sider class="h-full min-h-dvh bg-white text-gray-900">
    <a-layout-sider :width="240" class="min-h-screen bg-gray-50 p-2 shadow-none">
      <div
        class="flex h-full min-h-[calc(100dvh-16px)] flex-col justify-between rounded-lg bg-white px-2 py-4"
      >
        <div>
          <router-link
            :to="sidebarActions.home"
            aria-label="LLMOps UI home"
            class="mb-5 block h-9 w-[110px] rounded-lg bg-gray-200 px-2 text-sm font-semibold leading-9 transition-colors hover:bg-gray-300 focus-visible:outline-2 focus-visible:outline-blue-700"
            >LLMOps UI</router-link
          >
          <a-button
            type="primary"
            long
            class="mb-4 rounded-lg"
            aria-label="Create AI Application"
            @click="router.push(sidebarActions.createApp)"
          >
            <template #icon><icon-plus aria-hidden="true" /></template>
            Create AI Application
          </a-button>
          <nav aria-label="Main navigation" class="flex flex-col gap-2">
            <template v-for="group in navigationGroups" :key="group.label">
              <p v-if="group.label === 'Explore'" class="px-2 text-sm text-gray-500">Explore</p>
              <router-link
                v-for="item in group.items"
                :key="item.routeName"
                :to="{ name: item.routeName }"
                :aria-current="isActive(item.section) ? 'page' : undefined"
                :class="[
                  'flex h-8 items-center gap-2 rounded-lg px-2 text-sm leading-8 text-gray-700 transition-colors hover:bg-gray-200 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-blue-700',
                  { 'bg-gray-100': isActive(item.section) },
                ]"
              >
                <component
                  :is="
                    isActive(item.section)
                      ? navigationIcons[item.section].activeIcon
                      : navigationIcons[item.section].icon
                  "
                  aria-hidden="true"
                  class="block h-4 w-4 shrink-0"
                />
                <span class="min-w-0">{{ item.label }}</span>
              </router-link>
            </template>
          </nav>
        </div>
        <section aria-label="Signed-in account" class="mt-6">
          <a-dropdown v-model:popup-visible="accountMenuOpen" position="tl" trigger="click">
            <button
              type="button"
              aria-label="Account menu"
              aria-haspopup="menu"
              :aria-expanded="accountMenuOpen"
              class="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              <a-avatar
                :size="32"
                :image-url="accountStore.account?.avatar || undefined"
                class="shrink-0 bg-blue-700 text-sm"
                aria-label="Your avatar"
                >{{ accountInitial }}</a-avatar
              >
              <span class="flex min-w-0 flex-col">
                <span class="truncate text-sm text-gray-900" :title="accountStore.account?.name">{{
                  accountStore.account?.name || 'Your account'
                }}</span>
                <span
                  v-if="accountStore.account?.email"
                  class="truncate text-xs text-gray-500"
                  :title="accountStore.account.email"
                  >{{ accountStore.account.email }}</span
                >
                <span v-if="isLoadingAccount" role="status" class="text-xs text-gray-500"
                  >Loading account…</span
                >
              </span>
            </button>
            <template #content>
              <a-doption
                data-action="account-settings"
                @click="router.push(sidebarActions.account)"
              >
                <template #icon><icon-settings aria-hidden="true" /></template>
                Account settings
              </a-doption>
              <a-doption data-action="sign-out" :disabled="isLoggingOut" @click="signOut">
                <template #icon><icon-poweroff aria-hidden="true" /></template>
                {{ isLoggingOut ? 'Signing out…' : 'Sign out' }}
              </a-doption>
            </template>
          </a-dropdown>
        </section>
      </div>
    </a-layout-sider>
    <a-layout-content class="min-w-0">
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
    </a-layout-content>
  </a-layout>
</template>
