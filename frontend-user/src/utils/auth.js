/**
 * 认证状态管理模块
 *
 * 功能说明：
 * - 管理用户登录状态
 * - 处理登录/退出逻辑
 * - 持久化存储认证信息
 * - 资料只允许通过受控方法更新（updateCurrentUser），禁止页面直接改归属字段
 * - 登录失效（401/token无效）统一清除状态并通知订阅者弹出登录框
 *
 * 使用方式：
 * import { authState, login, logout, isAuthenticated } from '@/utils/auth'
 */

import { reactive } from 'vue'
import { api, logger } from './api'
import { taskStore } from './taskStore'

// ==================== 常量定义 ====================

const AUTH_TOKEN_KEY = 'billiard_token'
const AUTH_USER_KEY = 'billiard_user'

/** 资料中由服务端掌控、前端任何编辑入口都不得修改的字段（文档化白名单边界） */
export const PROTECTED_USER_FIELDS = Object.freeze(
  ['id', 'points', 'level', 'totalHours', 'competitions', 'wins', 'courses', 'totalSpent']
)

/** 编辑资料时允许修改的字段白名单 */
export const PROFILE_EDITABLE_FIELDS = ['name', 'phone', 'email']

// ==================== 响应式状态 ====================

/**
 * 认证状态对象（响应式）
 * @property {boolean} isLoggedIn - 是否已登录
 * @property {Object|null} user - 当前用户信息（仅通过受控方法更新）
 * @property {string|null} token - 认证令牌
 * @property {boolean} loading - 是否正在进行认证操作
 * @property {string|null} error - 最近一次错误信息
 */
export const authState = reactive({
  isLoggedIn: false,
  user: null,
  token: null,
  loading: false,
  error: null
})

/** 会话失效订阅者集合 */
const sessionExpiredListeners = new Set()

/**
 * 订阅登录失效事件（token过期、被踢下线等）
 * @param {Function} listener - 回调，参数为失效原因
 * @returns {Function} 取消订阅函数
 */
export function onSessionExpired(listener) {
  sessionExpiredListeners.add(listener)
  return () => sessionExpiredListeners.delete(listener)
}

function notifySessionExpired(reason) {
  logger.warn('Session expired', { reason })
  sessionExpiredListeners.forEach(fn => {
    try {
      fn(reason)
    } catch (e) {
      logger.error('Session expired listener error', e)
    }
  })
}

// ==================== 资料规范化 ====================

/**
 * 将可能缺字段/为空的用户数据规范化为完整安全结构
 * 防止模板中 user.name.charAt(0)、points.toLocaleString() 等崩溃
 * @param {any} raw
 * @returns {Object|null}
 */
export function normalizeUser(raw) {
  if (!raw || typeof raw !== 'object') return null
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)
  const str = (v, d = '') => (v == null ? d : String(v))
  return {
    id: str(raw.id),
    name: str(raw.name) || '会员',
    level: str(raw.level) || '普通',
    points: num(raw.points),
    totalHours: num(raw.totalHours),
    competitions: num(raw.competitions),
    wins: num(raw.wins),
    courses: num(raw.courses),
    totalSpent: num(raw.totalSpent),
    phone: str(raw.phone),
    email: str(raw.email)
  }
}

/**
 * 受控更新当前登录用户
 * - 只接受服务端返回的完整/补丁用户数据，逐字段合入
 * - 不信任前端传入的受保护字段以外的篡改（调用方应只传服务端数据）
 * - 同步持久化，保证刷新后一致
 * @param {Object} patch - 服务端返回的用户数据
 * @returns {Object|null} 合并后的用户
 */
export function updateCurrentUser(patch) {
  if (!authState.isLoggedIn || !authState.user) return null
  const incoming = normalizeUser(patch)
  if (!incoming || incoming.id !== authState.user.id) {
    // 归属不一致，拒绝写入，避免把A账户数据写到B账户
    logger.warn('Ignored user update with mismatched owner', {
      current: authState.user?.id,
      incoming: incoming?.id
    })
    return null
  }
  Object.assign(authState.user, incoming)
  persistUser(authState.user)
  return authState.user
}

// ==================== 公共方法 ====================

/**
 * 初始化认证状态
 * 从localStorage恢复登录状态，并绑定对应用户的数据桶
 */
export function initAuth() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const userStr = localStorage.getItem(AUTH_USER_KEY)

  if (token && userStr) {
    try {
      const user = normalizeUser(JSON.parse(userStr))
      if (!user || !user.id) throw new Error('invalid user payload')
      authState.token = token
      authState.user = user
      authState.isLoggedIn = true
      taskStore.purgeLegacyTasks()
      taskStore.bindUser(user.id)
      logger.info('Auth initialized from storage', { userId: user.id })
    } catch (e) {
      logger.error('Failed to parse stored user data', e)
      clearAuth()
    }
  } else if (token || userStr) {
    // 只有一半凭证，属于损坏状态，直接清除
    logger.warn('Incomplete auth storage found, clearing')
    clearAuth()
  }
}

/**
 * 用户登录
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
 */
export async function login(username, password) {
  authState.loading = true
  authState.error = null

  try {
    logger.info('Login attempt', { username })

    const result = await api.login(username, password)

    if (result.success) {
      const { token, user: rawUser } = result.data
      const user = normalizeUser(rawUser)
      if (!token || !user || !user.id) {
        throw new Error('登录返回数据不完整')
      }

      authState.token = token
      authState.user = user
      authState.isLoggedIn = true

      localStorage.setItem(AUTH_TOKEN_KEY, token)
      persistUser(user)

      // 清理旧版本全局任务数据，并绑定到当前账号的独立数据桶
      taskStore.purgeLegacyTasks()
      taskStore.bindUser(user.id)

      logger.info('Login successful', { userId: user.id })
      return { success: true, user }
    } else {
      throw new Error(result.error || '登录失败')
    }
  } catch (error) {
    authState.error = error.message
    logger.error('Login failed', error)
    return { success: false, error: error.message }
  } finally {
    authState.loading = false
  }
}

/**
 * 用户退出登录
 * 清除本地状态、存储，并解绑用户数据桶
 */
export async function logout() {
  const userId = authState.user?.id
  try {
    logger.info('Logout', { userId })
    await api.logout()
  } catch (e) {
    // 即使API调用失败，也要清除本地状态
    logger.warn('Logout API failed', e)
  } finally {
    clearAuth()
  }
}

/**
 * 因登录失效而退出（401等），会通知订阅者
 * @param {string} [reason]
 */
export async function forceLogout(reason = '登录状态已失效，请重新登录') {
  clearAuth()
  notifySessionExpired(reason)
}

export function isAuthenticated() {
  return authState.isLoggedIn && !!authState.token
}

export function getCurrentUser() {
  return authState.user
}

/**
 * 判断资料字段是否允许用户自行编辑
 * @param {string} field
 * @returns {boolean}
 */
export function isProfileFieldEditable(field) {
  return PROFILE_EDITABLE_FIELDS.includes(field)
}

// ==================== 私有方法 ====================

function persistUser(user) {
  try {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
  } catch (e) {
    logger.error('Persist user failed', e)
  }
}

/**
 * 清除认证状态
 * @private
 */
function clearAuth() {
  authState.isLoggedIn = false
  authState.user = null
  authState.token = null
  authState.error = null

  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)

  // 解绑用户数据桶，避免下一账号看到上一账号的任务/订单
  taskStore.unbindUser()

  logger.info('Auth state cleared')
}

export default {
  authState,
  initAuth,
  login,
  logout,
  forceLogout,
  isAuthenticated,
  getCurrentUser,
  updateCurrentUser,
  normalizeUser,
  onSessionExpired,
  isProfileFieldEditable
}
