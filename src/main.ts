import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ArcoVue from '@arco-design/web-vue'
import ArcoVueIcon from '@arco-design/web-vue/es/icon'

import App from '@/App.vue'
import router from '@/router'

// Also loads Arco's CSS, inside a cascade layer so Tailwind utilities can override it.
// Importing '@arco-design/web-vue/dist/arco.css' here would make it beat Tailwind.
import '@/assets/styles/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ArcoVue)
app.use(ArcoVueIcon)

app.mount('#app')

export default app
