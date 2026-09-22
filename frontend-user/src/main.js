import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initAuth, forceLogout } from './utils/auth'
import { setUnauthorizedHandler, logger } from './utils/api'

// 初始化认证状态（从localStorage恢复并绑定对应用户数据桶）
initAuth()

// 任何接口返回401/会话失效时：清除本地登录态并通知界面弹出登录框
setUnauthorizedHandler((reason) => {
  forceLogout(reason)
})

// 全局错误处理
window.addEventListener('error', (event) => {
  logger.error('Global error', { message: event.message, filename: event.filename, lineno: event.lineno })
})

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', { reason: event.reason })
})

logger.info('Application starting')

const app = createApp(App)
app.use(router)
app.mount('#app')

logger.info('Application mounted')
