import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { GetCurrentUserResponse } from '@/models/account'
import { get } from '@/utils/request'
import { getAccessToken } from '@/utils/auth'
import { DEV_ACCOUNT, isDevSession } from '@/services/auth'

export const useAccountStore = defineStore('account', () => {
  const account = ref<GetCurrentUserResponse['data'] | null>(null)
  const load = async () => {
    if (isDevSession()) {
      account.value = DEV_ACCOUNT
      return
    }
    const accessToken = getAccessToken()
    const response = await get<GetCurrentUserResponse>('/account')
    if (!accessToken || getAccessToken() !== accessToken) return
    if (
      !response.data ||
      typeof response.data.id !== 'string' ||
      typeof response.data.name !== 'string'
    ) {
      throw new Error('The server returned an invalid account response.')
    }
    account.value = response.data
  }
  const clear = () => {
    account.value = null
  }
  return { account, load, clear }
})
