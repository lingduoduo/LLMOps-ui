import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Account } from '@/models/account'
import type { BaseResponse } from '@/models/base'
import { get } from '@/utils/request'
import { getAccessToken } from '@/utils/auth'

export const useAccountStore = defineStore('account', () => {
  const account = ref<Account | null>(null)
  const load = async () => {
    const accessToken = getAccessToken()
    const response = await get<BaseResponse<Account>>('/account')
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
