/**
 * 认证状态管理模块
 *
 * 功能说明：
 * - 管理用户登录状态
 * - 处理登录/退出逻辑
 * - 持久化存储认证信息
 * - 提供受控的资料/积分修改入口（白名单字段 + 登录态校验）
 * - 会话失效广播（401、跨标签页退出）
 *
 * 使用方式：
 * import { authState, login, logout, isAuthenticated } from '@/utils/auth'
 *
 * // 检查登录状态
 * if (authState.isLoggedIn) { ... }
 *
 * // 执行登录
 * const result = await login('user', '123456')
 *
 * // 执行退出
 * await logout()
 */

import { reactive } from 'vue'
import { api, logger } from './api'

// ==================== 常量定义 ====================

/** localStorage中存储token的键名 */
const AUTH_TOKEN_KEY = 'billiard_token'

/** localStorage中存储用户信息的键名 */
const AUTH_USER_KEY = 'billiard_user'

/**
 * 允许用户自行修改的资料字段白名单
 * id、积分、等级、消费/打球统计等敏感字段不在此列，只能通过受控业务流程变更
 */
const EDITABLE_PROFILE_FIELDS = ['name', 'phone', 'email']

// ==================== 会话失效事件 ====================

/**
 * 会话失效订阅者集合
 * 触发场景：接口返回 401、其他标签页退出登录、本地凭证被清空
 */
const sessionExpiredListeners = new Set()

/**
 * 订阅会话失效事件
 * @param {Function} listener - 回调，接收失效原因 { reason }
 * @returns {Function} 取消订阅函数
 */
export function onSessionExpired(listener) {
  sessionExpiredListeners.add(listener)
  return () => sessionExpiredListeners.delete(listener)
}

/**
 * 使当前会话失效并通知所有订阅者
 * @param {string} reason - 失效原因
 * @private
 */
function expireSession(reason = 'unauthorized') {
  const wasLoggedIn = authState.isLoggedIn
  clearAuth()
  if (wasLoggedIn) {
    logger.warn('Session expired', { reason })
    sessionExpiredListeners.forEach(fn => {
      try {
        fn({ reason })
      } catch (e) {
        logger.error('Session expired listener error', e)
      }
    })
  }
}

// ==================== 响应式状态 ====================

/**
 * 认证状态对象（响应式）
 *
 * @property {boolean} isLoggedIn - 是否已登录
 * @property {Object|null} user - 当前用户信息
 * @property {string|null} token - 认证令牌
 * @property {boolean} loading - 是否正在进行认证操作
 * @property {string|null} error - 最近一次错误信息
 *
 * 使用示例：
 * import { authState } from '@/utils/auth'
 *
 * // 在模板中使用
 * <div v-if="authState.isLoggedIn">欢迎, {{ authState.user.name }}</div>
 *
 * // 在计算属性中使用
 * computed: {
 *   isLoggedIn() { return authState.isLoggedIn }
 * }
 */
export const authState = reactive({
  isLoggedIn: false,
  user: null,
  token: null,
  loading: false,
  error: null
})

// ==================== 公共方法 ====================

/**
 * 初始化认证状态
 * 从localStorage恢复登录状态，并监听跨标签页的登录态变化
 *
 * 应在应用启动时调用（main.js）
 *
 * 使用示例：
 * import { initAuth } from '@/utils/auth'
 * initAuth()
 */
export function initAuth() {
  restoreFromStorage()

  // 跨标签页同步：另一个标签页登录/退出时，本标签页状态保持一致
  window.addEventListener('storage', (event) => {
    if (event.key !== AUTH_TOKEN_KEY && event.key !== AUTH_USER_KEY) return
    if (!event.storageArea) return

    const token = event.storageArea.getItem(AUTH_TOKEN_KEY)
    const userStr = event.storageArea.getItem(AUTH_USER_KEY)

    if (!token || !userStr) {
      expireSession('cross_tab_logout')
      return
    }

    try {
      const user = JSON.parse(userStr)
      authState.token = token
      authState.user = user
      authState.isLoggedIn = true
      authState.error = null
      logger.info('Auth synced from another tab', { userId: user?.id })
    } catch (e) {
      logger.error('Failed to parse user data from storage event', e)
      expireSession('invalid_storage')
    }
  })
}

/**
 * 从localStorage恢复登录状态
 * @private
 */
function restoreFromStorage() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const userStr = localStorage.getItem(AUTH_USER_KEY)

  if (token && userStr) {
    try {
      const user = JSON.parse(userStr)
      // 凭证不完整视为无效，拒绝恢复
      if (!user || !user.id) {
        throw new Error('stored user is missing id')
      }
      authState.token = token
      authState.user = user
      authState.isLoggedIn = true
      logger.info('Auth initialized from storage', { userId: user.id })
    } catch (e) {
      // JSON解析失败/数据不完整，清除无效数据
      logger.error('Failed to parse stored user data', e)
      clearAuth()
    }
  } else if (token || userStr) {
    // 只有 token 或只有 user，凭证不完整
    clearAuth()
  }
}

/**
 * 用户登录
 *
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
 *
 * 使用示例：
 * const result = await login('user', '123456')
 * if (result.success) {
 *   console.log('登录成功', result.user)
 * } else {
 *   console.log('登录失败', result.error)
 * }
 */
export async function login(username, password) {
  // 已登录时先清理旧会话，避免新旧账户数据串用
  if (authState.isLoggedIn) {
    clearAuth()
  }

  // 设置加载状态
  authState.loading = true
  authState.error = null

  try {
    logger.info('Login attempt', { username })

    // 调用登录API
    const result = await api.login(username, password)

    if (result.success) {
      const { token, user } = result.data

      if (!token || !user || !user.id) {
        throw new Error('登录返回数据不完整')
      }

      // 更新状态
      authState.token = token
      authState.user = user
      authState.isLoggedIn = true

      // 持久化存储
      localStorage.setItem(AUTH_TOKEN_KEY, token)
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))

      logger.info('Login successful', { userId: user.id })
      return { success: true, user }
    } else {
      throw new Error(result.error || '登录失败')
    }
  } catch (error) {
    // 记录错误
    authState.error = error.message
    logger.error('Login failed', error)
    return { success: false, error: error.message }
  } finally {
    // 重置加载状态
    authState.loading = false
  }
}

/**
 * 用户退出登录
 * 清除本地状态和存储
 *
 * 使用示例：
 * await logout()
 * router.push('/')
 */
export async function logout() {
  try {
    logger.info('Logout', { userId: authState.user?.id })

    // 调用退出API（可选，主要用于服务端清理）
    await api.logout()
  } catch (e) {
    // 即使API调用失败，也要清除本地状态
    logger.warn('Logout API failed', e)
  } finally {
    clearAuth()
  }
}

/**
 * 检查是否已登录
 *
 * @returns {boolean} 是否已登录
 *
 * 使用示例：
 * if (isAuthenticated()) {
 *   // 执行需要登录的操作
 * }
 */
export function isAuthenticated() {
  return authState.isLoggedIn && !!authState.token && !!authState.user?.id
}

/**
 * 获取当前登录用户ID
 *
 * @returns {string|null} 用户ID，未登录返回null
 */
export function getCurrentUserId() {
  return authState.user?.id || null
}

/**
 * 获取当前登录用户
 *
 * @returns {Object|null} 用户信息，未登录返回null
 *
 * 使用示例：
 * const user = getCurrentUser()
 * if (user) {
 *   console.log('当前用户:', user.name)
 * }
 */
export function getCurrentUser() {
  return authState.user
}

/**
 * 受控更新用户资料（仅允许白名单字段）
 *
 * 任何页面/组件都不得直接整体替换 authState.user，敏感字段
 * （id、level、points、统计数据等）会被忽略，防止越权修改。
 *
 * @param {Object} updates - 待更新字段
 * @returns {{success: boolean, error?: string}}
 */
export function updateUserProfile(updates) {
  if (!isAuthenticated()) {
    return { success: false, error: '登录已失效，请重新登录' }
  }
  if (!updates || typeof updates !== 'object') {
    return { success: false, error: '资料数据无效' }
  }

  const allowed = {}
  EDITABLE_PROFILE_FIELDS.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      allowed[field] = updates[field]
    }
  })

  if (Object.keys(allowed).length === 0) {
    return { success: false, error: '没有可更新的资料字段' }
  }

  Object.assign(authState.user, allowed)
  persistUser()
  logger.info('User profile updated', { userId: authState.user.id, fields: Object.keys(allowed) })
  return { success: true, user: authState.user }
}

/**
 * 受控调整用户积分（如积分兑换）
 *
 * 只接受负数扣减且要求余额充足，积分增加只能由后端/业务流程发放，
 * 避免前端任意篡改积分。
 *
 * @param {number} delta - 积分变化量（负数表示扣减）
 * @param {string} [reason] - 变更原因
 * @returns {{success: boolean, error?: string}}
 */
export function adjustUserPoints(delta, reason = '') {
  if (!isAuthenticated()) {
    return { success: false, error: '登录已失效，请重新登录' }
  }
  const amount = Number(delta)
  if (!Number.isFinite(amount) || amount >= 0) {
    return { success: false, error: '积分变更不合法' }
  }
  const current = Number(authState.user.points) || 0
  if (current + amount < 0) {
    return { success: false, error: '积分余额不足' }
  }

  authState.user.points = current + amount
  persistUser()
  logger.info('User points adjusted', { userId: authState.user.id, delta: amount, reason })
  return { success: true, points: authState.user.points }
}

/**
 * 将当前用户信息写回localStorage
 * @private
 */
function persistUser() {
  if (authState.user && authState.token) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authState.user))
  }
}

// ==================== 私有方法 ====================

/**
 * 清除认证状态
 * 重置所有状态并清除localStorage
 *
 * @private
 */
function clearAuth() {
  // 重置状态
  authState.isLoggedIn = false
  authState.user = null
  authState.token = null
  authState.error = null

  // 清除存储
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)

  logger.info('Auth state cleared')
}

// ==================== 供 API 层调用 ====================

/**
 * 处理服务端鉴权失败（如 HTTP 401）
 * 由 api 层调用，清除会话并广播失效事件
 */
export function handleUnauthorized() {
  expireSession('unauthorized')
}

// ==================== 默认导出 ====================

export default {
  authState,
  initAuth,
  login,
  logout,
  isAuthenticated,
  getCurrentUser,
  getCurrentUserId,
  updateUserProfile,
  adjustUserPoints,
  onSessionExpired,
  handleUnauthorized
}
