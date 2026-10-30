import { createRouter, createWebHistory } from 'vue-router'
import { isLogin, SESSION_CLEARED_EVENT } from '@/utils/auth'
import DefaultLayout from '@/views/layouts/DefaultLayout.vue'
import BlankLayout from '@/views/layouts/BlankLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: DefaultLayout,
      children: [
        {
          path: '',
          redirect: 'home',
        },
        {
          path: 'home',
          name: 'pages-home',
          component: () => import('@/views/pages/HomeView.vue'),
        },
        {
          path: 'space/apps',
          name: 'space-apps-list',
          component: () => import('@/views/space/apps/ListView.vue'),
        },
        {
          path: 'space/apps/:app_id',
          name: 'space-apps-detail',
          component: () => import('@/views/space/apps/DetailView.vue'),
        },
      ],
    },
    {
      path: '/',
      component: BlankLayout,
      children: [
        {
          path: 'auth/login',
          name: 'auth-login',
          component: () => import('@/views/auth/LoginView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  if (to.name !== 'auth-login' && !isLogin()) {
    return { name: 'auth-login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'auth-login' && isLogin()) return { name: 'space-apps-list' }
})

window.addEventListener(SESSION_CLEARED_EVENT, () => {
  if (router.currentRoute.value.name !== 'auth-login') {
    void router.replace({
      name: 'auth-login',
      query: { redirect: router.currentRoute.value.fullPath },
    })
  }
})

export default router
