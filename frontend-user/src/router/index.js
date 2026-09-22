import { createRouter, createWebHistory } from 'vue-router'
import { logger } from '../utils/api'
import { isAuthenticated } from '../utils/auth'
import { openLoginModal } from '../utils/ui'
import Home from '../views/Home.vue'
import Tables from '../views/Tables.vue'
import Courses from '../views/Courses.vue'
import Competitions from '../views/Competitions.vue'
import Shop from '../views/Shop.vue'
import Profile from '../views/Profile.vue'
import Tasks from '../views/Tasks.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/tables', name: 'Tables', component: Tables },
  { path: '/courses', name: 'Courses', component: Courses },
  { path: '/competitions', name: 'Competitions', component: Competitions },
  { path: '/shop', name: 'Shop', component: Shop },
  {
    path: '/profile',
    name: 'Profile',
    component: Profile,
    meta: { requiresAuth: true }
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: Tasks,
    meta: { requiresAuth: true }
  },
  // 兼容历史链接 /login：回到首页并唤起登录弹窗
  { path: '/login', redirect: { path: '/', query: { login: '1' } } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  logger.info('Navigation', { from: from.path, to: to.path })

  if (to.meta.requiresAuth && !isAuthenticated()) {
    logger.warn('Navigation blocked: login required', { to: to.path })
    openLoginModal('请先登录后再访问该页面')
    next({ path: '/', query: { login: '1', redirect: to.fullPath } })
    return
  }

  next()
})

export default router
