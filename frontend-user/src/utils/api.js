/**
 * API 接口层
 *
 * 功能说明：
 * - 封装所有后端API请求
 * - 支持模拟数据模式和真实API模式
 * - 提供统一的错误处理和日志记录
 * - 所有用户相关接口都携带 token，服务端据此判定数据归属
 * - 401 统一触发登录失效流程（由 auth 模块注册处理器，避免循环依赖）
 *
 * 使用方式：
 * import { api, logger } from '@/utils/api'
 * const result = await api.login('user', '123456')
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const LOG_LEVEL = import.meta.env.VITE_LOG_LEVEL || 'info'
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }

import { taskStore as ts } from './taskStore'
const taskStore = ts

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export const logger = {
  shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL]
  },
  format(level, message) {
    return `[${level.toUpperCase()}] ${new Date().toISOString()} - ${message}`
  },
  debug(message, data) {
    if (this.shouldLog('debug')) {
      console.debug(this.format('debug', message), data || '')
    }
  },
  info(message, data) {
    if (this.shouldLog('info')) {
      console.log(this.format('info', message), data || '')
    }
  },
  warn(message, data) {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message), data || '')
    }
  },
  error(message, error) {
    if (this.shouldLog('error')) {
      console.error(this.format('error', message), error || '')
    }
  }
}

// ==================== 登录失效处理 ====================

let unauthorizedHandler = null

/**
 * 注册登录失效处理器（由 auth 模块在应用启动时注册，避免循环依赖）
 * @param {Function} handler - (reason: string) => void
 */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

function handleUnauthorized(reason) {
  logger.warn('Unauthorized request', reason)
  if (unauthorizedHandler) {
    unauthorizedHandler(reason)
  }
}

/** 鉴权失败错误，便于调用方识别 */
class UnauthorizedError extends Error {
  constructor(message = '登录状态已失效，请重新登录') {
    super(message)
    this.name = 'UnauthorizedError'
    this.isUnauthorized = true
  }
}

// ==================== 请求封装 ====================

/**
 * 从 options / localStorage 解析当前 token
 */
function resolveToken(options = {}) {
  const headerToken = options.token
  if (headerToken) return String(headerToken)
  try {
    return localStorage.getItem('billiard_token') || ''
  } catch {
    return ''
  }
}

/**
 * 统一请求封装
 * @param {string} url - 请求路径（不含基础URL）
 * @param {Object} options - { method, body, headers, params, token }
 * @returns {Promise<{success: boolean, data?: any, error?: string, unauthorized?: boolean}>}
 */
async function request(url, options = {}) {
  const fullUrl = `${API_BASE_URL}${url}`
  const token = resolveToken(options)
  const method = options.method || 'GET'
  logger.info(`API Request: ${method} ${fullUrl}`)

  try {
    if (import.meta.env.VITE_USE_MOCK !== 'false') {
      logger.debug('Using mock data mode')
      return await mockRequest(url, { ...options, token })
    }

    let queryUrl = url
    if (options.params) {
      const qs = new URLSearchParams(
        Object.entries(options.params).filter(([, v]) => v !== undefined && v !== null)
      ).toString()
      if (qs) queryUrl += (url.includes('?') ? '&' : '?') + qs
    }

    const response = await fetch(`${API_BASE_URL}${queryUrl}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      },
      body: options.body
    })

    if (response.status === 401) {
      throw new UnauthorizedError()
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    logger.info(`API Response: ${url}`, { status: 'success' })
    return { success: true, data }
  } catch (error) {
    logger.error(`API Error: ${url}`, error)
    if (error.isUnauthorized) {
      handleUnauthorized(error.message)
      return { success: false, error: error.message, unauthorized: true }
    }
    return {
      success: false,
      error: error.message || '网络请求失败，请稍后重试'
    }
  }
}

// ==================== 模拟数据 ====================

/**
 * 模拟账号库（模拟服务端用户表）
 */
const mockAccounts = {
  user: {
    username: 'user',
    password: '123456',
    profile: {
      id: 'U20260001',
      name: '张三',
      level: '黄金',
      points: 2580,
      totalHours: 156,
      competitions: 12,
      wins: 8,
      courses: 3,
      totalSpent: 8660,
      phone: '138****8888',
      email: 'zhang***@email.com'
    }
  },
  lisi: {
    username: 'lisi',
    password: '123456',
    profile: {
      id: 'U20260002',
      name: '李四',
      level: '白银',
      points: 320,
      totalHours: 24,
      competitions: 2,
      wins: 1,
      courses: 1,
      totalSpent: 980,
      phone: '',
      email: ''
    }
  }
}

/** mock token: mock_token_<timestamp>_<userId>，由“服务端”签发 */
function signMockToken(userId) {
  return `mock_token_${Date.now()}_${userId}`
}

function parseMockToken(token) {
  if (!token || typeof token !== 'string') return null
  const m = token.match(/^mock_token_\d+_(.+)$/)
  if (!m) return null
  const userId = m[1]
  const account = Object.values(mockAccounts).find(a => a.profile.id === userId)
  return account ? account : null
}

function storageKeyFor(userId, name) {
  return `billiard_mock_${name}:${userId}`
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    logger.warn('mock storage write failed', e)
  }
}

/**
 * 获取某用户的服务端视角资料（基础资料 + 资料修改补丁 + 积分/积分流水）
 */
function buildUserProfile(account) {
  const userId = account.profile.id
  const patch = readJSON(storageKeyFor(userId, 'profile_patch'), {})
  const pointsState = readJSON(storageKeyFor(userId, 'points'), {
    points: account.profile.points,
    history: defaultPointsHistory(account.profile.points)
  })
  return {
    ...account.profile,
    ...patch,
    points: typeof pointsState.points === 'number' ? pointsState.points : account.profile.points
  }
}

function defaultPointsHistory(currentPoints) {
  // 演示账号给出示例流水；其他账号给空列表
  if (currentPoints >= 2580) {
    return [
      { id: 1, title: '预约消费奖励', date: '2026-02-10', amount: 50, type: 'add' },
      { id: 2, title: '课程报名奖励', date: '2026-02-08', amount: 100, type: 'add' },
      { id: 3, title: '兑换优惠券', date: '2026-02-05', amount: 200, type: 'minus' },
      { id: 4, title: '比赛获奖', date: '2026-01-20', amount: 500, type: 'add' }
    ]
  }
  return []
}

function getPointsState(account) {
  const key = storageKeyFor(account.profile.id, 'points')
  const state = readJSON(key, null)
  if (state && typeof state.points === 'number') return state
  const initial = { points: account.profile.points, history: defaultPointsHistory(account.profile.points) }
  writeJSON(key, initial)
  return initial
}

function savePointsState(account, state) {
  writeJSON(storageKeyFor(account.profile.id, 'points'), state)
}

function todayStr() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ---------- mock 业务处理 ----------

function handleLogin(options) {
  const body = JSON.parse(options.body || '{}')
  const { username, password } = body
  const account = Object.values(mockAccounts).find(a => a.username === username)

  if (account && account.password === password) {
    const token = signMockToken(account.profile.id)
    logger.info('Mock login successful', { username, userId: account.profile.id })
    return { token, user: buildUserProfile(account) }
  }

  logger.warn('Mock login failed', { username })
  throw new Error('用户名或密码错误')
}

function handleLogout() {
  logger.info('Mock logout')
  return { message: '退出成功' }
}

/** 获取资料：无token（单测场景）返回演示账号快照；带token必须合法且只返回本人资料 */
function handleGetProfile(options) {
  const account = parseMockToken(options.token)
  if (options.token) {
    if (!account) throw new UnauthorizedError()
    return buildUserProfile(account)
  }
  return buildUserProfile(mockAccounts.user)
}

const PROFILE_PATCH_FIELDS = ['name', 'phone', 'email']

/** 更新资料：仅允许白名单字段，服务端忽略其余字段（受控修改） */
function handleUpdateProfile(options) {
  const account = parseMockToken(options.token)
  if (!account) throw new UnauthorizedError()

  const body = JSON.parse(options.body || '{}')
  const patch = {}
  PROFILE_PATCH_FIELDS.forEach(field => {
    if (typeof body[field] === 'string') patch[field] = body[field].trim()
  })
  if (!patch.name || patch.name.length < 2) {
    throw new Error('昵称至少需要2个字符')
  }

  const key = storageKeyFor(account.profile.id, 'profile_patch')
  const prev = readJSON(key, {})
  writeJSON(key, { ...prev, ...patch })
  return buildUserProfile(account)
}

/** 积分兑换：服务端校验余额并扣减、记流水 */
function handleExchangePoints(options) {
  const account = parseMockToken(options.token)
  if (!account) throw new UnauthorizedError()

  const body = JSON.parse(options.body || '{}')
  const cost = Number(body.points)
  const giftName = typeof body.giftName === 'string' ? body.giftName : '礼品'
  if (!Number.isFinite(cost) || cost <= 0) throw new Error('兑换积分不合法')

  const state = getPointsState(account)
  if (state.points < cost) throw new Error('积分不足，无法兑换')

  state.points -= cost
  state.history.unshift({
    id: Date.now(),
    title: `兑换${giftName}`,
    date: todayStr(),
    amount: cost,
    type: 'minus'
  })
  savePointsState(account, state)
  return { points: state.points, history: state.history, profile: buildUserProfile(account) }
}

function handleBookings(options) {
  if (options.method === 'POST') {
    const body = JSON.parse(options.body || '{}')
    const orderNo = 'BK' + Date.now().toString().slice(-8)
    logger.info('Mock booking created', { orderNo })
    return { orderNo, ...body, status: 'upcoming' }
  }
  // 未携带token的单测场景：返回示例公共数据
  return [
    { id: 1, orderNo: 'BK20260001', tableName: '3号球桌 - 美式九球', date: '2026-02-15', time: '14:00 - 16:00', status: 'upcoming' },
    { id: 2, orderNo: 'BK20260002', tableName: '1号球桌 - 斯诺克', date: '2026-02-10', time: '19:00 - 21:00', status: 'completed' }
  ]
}

function handleOrders(options) {
  if (options.method === 'POST') {
    const body = JSON.parse(options.body || '{}')
    const orderNo = 'SP' + Date.now().toString().slice(-8)
    logger.info('Mock order created', { orderNo })
    return { orderNo, ...body, status: 'paid' }
  }
  return []
}

/**
 * 用户任务接口：严格按 token 归属读写
 */
function handleUserTasks(options) {
  const account = parseMockToken(options.token)
  if (!account) {
    if (options.method === 'POST') throw new UnauthorizedError()
    // GET 无token（单测直接调api）返回空，避免泄露演示账号任务
    return []
  }
  // 确保 taskStore 与 token 归属一致，防止本地状态被外部改串
  taskStore.bindUser(account.profile.id)

  if (options.method === 'POST') {
    const body = JSON.parse(options.body || '{}')
    const { taskId, action } = body
    logger.info('Task action via API', { taskId, action, userId: account.profile.id })

    if (action === 'pay') {
      const result = taskStore.markAsPaid(taskId)
      return { success: !!result, message: result ? '支付成功' : '支付失败' }
    }
    if (action === 'cancel') {
      const result = taskStore.remove(taskId)
      return { success: result, message: result ? '取消成功' : '取消失败' }
    }
    if (action === 'confirm') {
      const task = taskStore.getById(taskId)
      if (!task || task.status !== 'shipped') {
        return { success: false, message: '当前状态不可确认收货' }
      }
      const result = taskStore.update(taskId, { status: 'completed', subtitle: '已完成' })
      // 完成订单按实付金额 1 元 = 1 积分奖励，仅奖励一次
      let pointsAwarded = 0
      if (result && !task.pointsAwarded) {
        pointsAwarded = Number(task.amount) || 0
        if (pointsAwarded > 0) {
          taskStore.update(taskId, { pointsAwarded })
          const state = getPointsState(account)
          state.points += pointsAwarded
          state.history.unshift({
            id: Date.now(),
            title: `订单完成奖励 ${task.title}`,
            date: todayStr(),
            amount: pointsAwarded,
            type: 'add'
          })
          savePointsState(account, state)
        }
      }
      return {
        success: true,
        message: '确认收货成功',
        pointsAwarded,
        points: getPointsState(account).points,
        profile: buildUserProfile(account)
      }
    }
    return { success: true, message: '操作成功' }
  }

  const params = options.params || {}
  if (params.status) {
    return taskStore.getByStatus(params.status)
  }
  return taskStore.getAll()
}

/** 积分流水 */
function handlePointsHistory(options) {
  const account = parseMockToken(options.token)
  if (!account) throw new UnauthorizedError()
  return getPointsState(account).history
}

// ==================== 路由 ====================

async function mockRequest(url, options) {
  // 登录/登出保持原有延迟手感；其余接口快速返回，保证快速切换栏目时响应及时
  const authed = ['/auth/login', '/auth/logout'].includes(url)
  await delay(authed ? 500 + Math.random() * 500 : 80 + Math.random() * 120)

  const mockHandlers = {
    '/auth/login': handleLogin,
    '/auth/logout': handleLogout,
    '/tables': () => mockData.tables,
    '/courses': () => mockData.courses,
    '/competitions': () => mockData.competitions,
    '/products': () => mockData.products,
    '/user/profile': (opts) =>
      opts.method === 'PUT' ? handleUpdateProfile(opts) : handleGetProfile(opts),
    '/user/points/history': handlePointsHistory,
    '/user/points/exchange': handleExchangePoints,
    '/bookings': handleBookings,
    '/orders': handleOrders,
    '/user/tasks': handleUserTasks
  }

  const handler = mockHandlers[url]
  if (handler) {
    try {
      const result = await handler(options)
      return { success: true, data: result }
    } catch (error) {
      if (error.isUnauthorized) {
        handleUnauthorized(error.message)
        return { success: false, error: error.message, unauthorized: true }
      }
      return { success: false, error: error.message }
    }
  }

  return { success: false, error: `API not found: ${url}` }
}

// ==================== 公共静态数据 ====================

const mockData = {
  tables: [
    { id: 1, name: '1号球桌', type: '斯诺克', typeId: 'snooker', price: 80, available: true, size: '12尺', brand: '星牌' },
    { id: 2, name: '2号球桌', type: '斯诺克', typeId: 'snooker', price: 80, available: false, size: '12尺', brand: '星牌' },
    { id: 3, name: '3号球桌', type: '美式九球', typeId: 'pool', price: 60, available: true, size: '9尺', brand: 'Brunswick' },
    { id: 4, name: '4号球桌', type: '美式九球', typeId: 'pool', price: 60, available: true, size: '9尺', brand: 'Brunswick' },
    { id: 5, name: '5号球桌', type: '中式八球', typeId: 'chinese', price: 50, available: false, size: '9尺', brand: '乔氏' },
    { id: 6, name: '6号球桌', type: '中式八球', typeId: 'chinese', price: 50, available: true, size: '9尺', brand: '乔氏' }
  ],
  courses: [
    { id: 1, name: '台球入门基础课', icon: '🎯', level: '入门', duration: '4周', lessons: '8课时', students: 156, price: 599, originalPrice: 799, description: '从零开始学习台球', coach: '张明', coachTitle: '高级教练', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { id: 2, name: '斯诺克进阶训练', icon: '🎱', level: '进阶', duration: '6周', lessons: '12课时', students: 89, price: 1299, originalPrice: 1599, description: '深入学习斯诺克战术', coach: '李强', coachTitle: '国家级教练', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }
  ],
  competitions: [
    { id: 1, name: '2026春季斯诺克公开赛', type: '斯诺克', date: '2026-03-15', location: '主馆A区', prize: 50000, fee: 200, participants: 28, maxParticipants: 32, status: 'upcoming' },
    { id: 2, name: '周末九球挑战赛', type: '美式九球', date: '2026-02-14', location: '主馆B区', prize: 10000, fee: 100, participants: 16, maxParticipants: 16, status: 'ongoing' }
  ],
  products: [
    { id: 1, name: 'LP专业斯诺克球杆', brand: 'LP', price: 2999, originalPrice: 3599, category: 'cue', icon: '🏏', description: '进口白蜡木杆身', sales: 328, hot: true },
    { id: 2, name: '星牌比赛用球', brand: '星牌', price: 1299, originalPrice: 1499, category: 'ball', icon: '🎱', description: '国际比赛标准', sales: 892, hot: true }
  ]
}

// ==================== 导出API方法 ====================

export const api = {
  login: (username, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  getTables: (params) => request('/tables', { params }),

  bookTable: (data) => request('/bookings', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  getCourses: () => request('/courses'),

  enrollCourse: (data) => request('/courses/enroll', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  getCompetitions: (params) => request('/competitions', { params }),

  joinCompetition: (data) => request('/competitions/join', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  getProducts: (params) => request('/products', { params }),

  createOrder: (data) => request('/orders', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  /** 获取当前登录用户资料（服务端按 token 归属返回） */
  getProfile: () => request('/user/profile'),

  /**
   * 更新用户资料（受控：仅白名单字段生效，服务端最终裁决）
   * @param {Object} data - 仅 name/phone/email 会被接受
   */
  updateProfile: (data) => request('/user/profile', {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  /** 获取积分明细 */
  getPointsHistory: () => request('/user/points/history'),

  /**
   * 积分兑换
   * @param {{points: number, giftName?: string}} data
   */
  exchangePoints: (data) => request('/user/points/exchange', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  getBookings: () => request('/bookings'),

  getTasks: (params) => request('/user/tasks', { params }),

  doTaskAction: (data) => request('/user/tasks', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export default api
