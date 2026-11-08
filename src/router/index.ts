import { createRouter, createWebHistory } from 'vue-router'
import { isLogin, SESSION_CLEARED_EVENT } from '@/utils/auth'
import { useAccountStore } from '@/stores/account'
import DefaultLayout from '@/views/layouts/DefaultLayout.vue'
import BlankLayout from '@/views/layouts/BlankLayout.vue'

declare module 'vue-router' {
  interface RouteMeta {
    // Reachable without signing in.
    public?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: DefaultLayout,
      children: [
        {
          path: '',
          redirect: { name: 'pages-home' },
        },
        {
          path: 'home',
          name: 'pages-home',
          component: () => import('@/views/pages/HomeView.vue'),
        },
        {
          path: 'about',
          name: 'pages-about',
          component: () => import('@/views/AboutView.vue'),
        },
        {
          path: 'space/apps',
          name: 'space-apps-list',
          component: () => import('@/views/space/apps/ListView.vue'),
        },
        {
          path: 'store/tools',
          name: 'store-tools-list',
          component: () => import('@/views/store/tools/ListView.vue'),
        },
        {
          path: 'store/apps',
          name: 'store-apps-list',
          component: () => import('@/views/store/apps/ListView.vue'),
        },
      ],
    },
    {
      path: '/',
      component: BlankLayout,
      children: [
        {
          path: 'space/apps/:app_id',
          name: 'space-apps-detail',
          component: () => import('@/views/space/apps/DetailView.vue'),
        },
        {
          path: 'auth/login',
          name: 'auth-login',
          component: () => import('@/views/auth/LoginView.vue'),
          meta: { public: true },
        },
        {
          path: ':pathMatch(.*)+',
          name: 'not-found',
          component: () => import('@/views/errors/NotFoundView.vue'),
          meta: { public: true },
        },
      ],
    },
  ],
})

// True while the guard confirms the session with the backend; the guard redirects itself then.
let verifyingSession = false

router.beforeEach(async (to) => {
  if (to.meta.public) {
    if (to.name === 'auth-login' && isLogin()) return { name: 'space-apps-list' }
    return
  }
  const toLogin = { name: 'auth-login', query: { redirect: to.fullPath } }
  if (!isLogin()) return toLogin
  // A stored token can be revoked server-side, so confirm it once by loading the account.
  const accountStore = useAccountStore()
  if (accountStore.account) return
  verifyingSession = true
  try {
    await accountStore.load()
  } catch {
    // A 401 clears the credential; other failures (e.g. backend down) keep the session and
    // let the layout show the error.
    if (!isLogin()) return toLogin
  } finally {
    verifyingSession = false
  }
})

window.addEventListener(SESSION_CLEARED_EVENT, () => {
  if (!verifyingSession && router.currentRoute.value.name !== 'auth-login') {
    void router.replace({
      name: 'auth-login',
      query: { redirect: router.currentRoute.value.fullPath },
    })
  }
})

export default router
