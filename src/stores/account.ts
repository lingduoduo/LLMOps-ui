import { defineStore } from 'pinia'
import { ref } from 'vue'

// 初始值
const initAccount = {
  name: 'Ling',
  email: 'linghypshen@gmail.com',
  avatar: '',
}

export const useAccountStore = defineStore('account', () => {
  // 1.Define Data
  const account = ref({ ...initAccount })

  // 2.Fucntions/Actions
  function update(params: any) {
    Object.assign(account.value, params)
  }

  function clear() {
    account.value = { ...initAccount }
  }

  return { account, update, clear }
})
