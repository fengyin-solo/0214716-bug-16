/**
 * 任务中心存储管理
 * 统一管理预约、报名、订单等任务数据，使用 localStorage 持久化
 *
 * 数据归属：
 * - 所有数据按当前登录用户 ID 隔离存储
 * - 未登录时读操作返回空集合，写操作一律拒绝
 * - 读取/修改/删除均校验任务归属，杜绝跨账户看到或操作他人订单
 */

import { getCurrentUserId, isAuthenticated } from './auth'

const STORAGE_KEY = 'billiard_user_tasks'
const STORAGE_VERSION = 2

const logger = {
  info: (...args) => console.log('[taskStore]', ...args),
  warn: (...args) => console.warn('[taskStore]', ...args),
  error: (...args) => console.error('[taskStore]', ...args)
}

const taskTypeConfig = {
  booking: {
    name: '球桌预约',
    icon: '🎱',
    actions: {
      pending_payment: [
        { key: 'pay', label: '继续付款', type: 'primary', route: '/tables' },
        { key: 'cancel', label: '取消', type: 'danger' }
      ],
      upcoming: [
        { key: 'view', label: '查看详情', type: 'primary' },
        { key: 'rebook', label: '再次预约', type: 'default', route: '/tables' }
      ],
      ongoing: [
        { key: 'view', label: '查看详情', type: 'primary' }
      ],
      completed: [
        { key: 'view', label: '查看结果', type: 'default' },
        { key: 'rebook', label: '再次预约', type: 'primary', route: '/tables' }
      ],
      cancelled: [
        { key: 'view', label: '查看详情', type: 'default' },
        { key: 'rebook', label: '再次预约', type: 'primary', route: '/tables' }
      ]
    }
  },
  course: {
    name: '课程报名',
    icon: '📚',
    actions: {
      pending_payment: [
        { key: 'pay', label: '继续付款', type: 'primary', route: '/courses' },
        { key: 'cancel', label: '取消', type: 'danger' }
      ],
      upcoming: [
        { key: 'view', label: '查看详情', type: 'primary', route: '/courses' }
      ],
      ongoing: [
        { key: 'view', label: '继续学习', type: 'primary', route: '/courses' }
      ],
      completed: [
        { key: 'view', label: '查看结果', type: 'default' },
        { key: 'review', label: '评价', type: 'primary' }
      ],
      cancelled: [
        { key: 'view', label: '查看详情', type: 'default' }
      ]
    }
  },
  competition: {
    name: '赛事报名',
    icon: '🏆',
    actions: {
      pending_payment: [
        { key: 'pay', label: '继续付款', type: 'primary', route: '/competitions' },
        { key: 'cancel', label: '取消', type: 'danger' }
      ],
      upcoming: [
        { key: 'view', label: '查看赛程', type: 'primary', route: '/competitions' }
      ],
      ongoing: [
        { key: 'view', label: '观看直播', type: 'primary', route: '/competitions' }
      ],
      completed: [
        { key: 'view', label: '查看结果', type: 'default', route: '/competitions' }
      ],
      cancelled: [
        { key: 'view', label: '查看详情', type: 'default', route: '/competitions' }
      ]
    }
  },
  order: {
    name: '商城订单',
    icon: '🛒',
    actions: {
      pending_payment: [
        { key: 'pay', label: '继续付款', type: 'primary', route: '/shop' },
        { key: 'cancel', label: '取消', type: 'danger' }
      ],
      pending_shipment: [
        { key: 'view', label: '查看订单', type: 'primary', route: '/shop' },
        { key: 'remind', label: '提醒发货', type: 'default' }
      ],
      shipped: [
        { key: 'view', label: '查看物流', type: 'primary', route: '/shop' },
        { key: 'confirm', label: '确认收货', type: 'primary' }
      ],
      completed: [
        { key: 'view', label: '查看结果', type: 'default', route: '/shop' },
        { key: 'review', label: '评价', type: 'primary' },
        { key: 'rebuy', label: '再次购买', type: 'default', route: '/shop' }
      ],
      cancelled: [
        { key: 'view', label: '查看订单', type: 'default', route: '/shop' },
        { key: 'rebuy', label: '再次购买', type: 'default', route: '/shop' }
      ]
    }
  }
}

const statusConfig = {
  pending_payment: { text: '待付款', type: 'warning' },
  upcoming: { text: '待开始', type: 'info' },
  ongoing: { text: '进行中', type: 'primary' },
  pending_shipment: { text: '待发货', type: 'warning' },
  shipped: { text: '已发货', type: 'info' },
  completed: { text: '已完成', type: 'success' },
  cancelled: { text: '已取消', type: 'success' }
}

/** 已支付（计入消费统计）的状态 */
const PAID_STATUSES = ['upcoming', 'ongoing', 'pending_shipment', 'shipped', 'completed']

// ==================== 存储读写（按用户隔离） ====================

/**
 * 加载整个存储结构
 * 兼容并清理旧版本的无主数据（旧格式为数组，无法归属任何用户，直接废弃）
 * @returns {{version: number, users: Object}}
 */
function loadStore() {
  const empty = { version: STORAGE_VERSION, users: {} }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return empty

    const parsed = JSON.parse(stored)

    // 旧版本 / 被污染的数据（顶层为数组或缺少 users）：无归属，全部清除
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.users) {
      logger.warn('检测到无归属的旧任务数据，已废弃隔离')
      saveStore(empty)
      return empty
    }

    return { version: STORAGE_VERSION, users: parsed.users }
  } catch (e) {
    logger.error('加载任务存储失败', e)
    saveStore(empty)
    return empty
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    return true
  } catch (e) {
    logger.error('保存任务存储失败', e)
    return false
  }
}

/**
 * 获取当前登录用户ID
 * @returns {string|null}
 */
function currentUserId() {
  return isAuthenticated() ? getCurrentUserId() : null
}

/**
 * 读取当前用户的命名空间（不存在则返回空结构，不自动写入）
 * @returns {{tasks: Array, pointsRecords: Array}|null} 未登录返回null
 */
function getNamespace() {
  const userId = currentUserId()
  if (!userId) return null

  const store = loadStore()
  const ns = store.users[userId]
  return {
    tasks: Array.isArray(ns?.tasks) ? ns.tasks : [],
    pointsRecords: Array.isArray(ns?.pointsRecords) ? ns.pointsRecords : []
  }
}

/**
 * 写回当前用户的命名空间
 * @param {{tasks: Array, pointsRecords: Array}} namespace
 * @returns {boolean}
 */
function saveNamespace(namespace) {
  const userId = currentUserId()
  if (!userId) {
    logger.warn('未登录，禁止写入任务数据')
    return false
  }
  const store = loadStore()
  store.users[userId] = namespace
  return saveStore(store)
}

function formatDate(date) {
  const d = new Date(date)
  const pad = n => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function generateTaskId() {
  return 'T' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0')
}

function enrichTask(task) {
  const typeInfo = taskTypeConfig[task.type]
  const statusInfo = statusConfig[task.status]
  const actions = typeInfo?.actions?.[task.status] || []

  return {
    ...task,
    typeName: typeInfo?.name || task.type,
    typeIcon: typeInfo?.icon || '📋',
    statusText: statusInfo?.text || task.status,
    statusType: statusInfo?.type || 'info',
    actions: actions
  }
}

export const taskStore = {
  /**
   * 获取当前用户的全部任务（按创建时间倒序）
   * 未登录返回空数组
   */
  getAll() {
    const ns = getNamespace()
    if (!ns) return []
    return ns.tasks.map(enrichTask).sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    )
  },

  getByStatus(status) {
    const tasks = this.getAll()
    if (status === 'pending') {
      return tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
    }
    if (status === 'completed') {
      return tasks.filter(t => t.status === 'completed')
    }
    return tasks
  },

  /**
   * 按ID获取任务，仅限当前用户自己的任务
   */
  getById(taskId) {
    const ns = getNamespace()
    if (!ns) return null
    const task = ns.tasks.find(t => t.id === taskId)
    return task ? enrichTask(task) : null
  },

  /**
   * 新增任务，强制标记为当前登录用户所有
   * 未登录时拒绝写入
   */
  add(taskData) {
    const userId = currentUserId()
    if (!userId) {
      logger.warn('未登录，禁止创建任务')
      return null
    }

    const ns = getNamespace()
    // 强制归属，忽略调用方传入的 userId / id / createdAt
    const newTask = {
      ...taskData,
      id: generateTaskId(),
      createdAt: formatDate(new Date()),
      userId
    }
    ns.tasks.unshift(newTask)

    if (!saveNamespace(ns)) return null
    logger.info('任务已添加', { id: newTask.id, userId })
    return enrichTask(newTask)
  },

  /**
   * 更新任务，仅限任务归属人
   */
  update(taskId, updates) {
    const userId = currentUserId()
    if (!userId) {
      logger.warn('未登录，禁止更新任务')
      return null
    }

    const ns = getNamespace()
    const index = ns.tasks.findIndex(t => t.id === taskId && t.userId === userId)
    if (index === -1) {
      logger.warn('任务不存在或不属于当前用户', { taskId, userId })
      return null
    }

    // 禁止通过更新篡改归属、ID、创建时间
    const safeUpdates = { ...updates }
    delete safeUpdates.userId
    delete safeUpdates.id
    delete safeUpdates.createdAt
    ns.tasks[index] = { ...ns.tasks[index], ...safeUpdates }

    if (!saveNamespace(ns)) return null
    logger.info('任务已更新', { taskId, fields: Object.keys(safeUpdates) })
    return enrichTask(ns.tasks[index])
  },

  updateStatus(taskId, newStatus) {
    const statusInfo = statusConfig[newStatus]
    if (!statusInfo) {
      logger.error('无效的状态', newStatus)
      return null
    }
    return this.update(taskId, { status: newStatus })
  },

  /**
   * 删除任务，仅限任务归属人
   */
  remove(taskId) {
    const userId = currentUserId()
    if (!userId) {
      logger.warn('未登录，禁止删除任务')
      return false
    }

    const ns = getNamespace()
    const filtered = ns.tasks.filter(t => !(t.id === taskId && t.userId === userId))
    if (filtered.length === ns.tasks.length) {
      logger.warn('任务不存在或不属于当前用户，无法删除', { taskId, userId })
      return false
    }

    ns.tasks = filtered
    const ok = saveNamespace(ns)
    if (ok) logger.info('任务已删除', { taskId })
    return ok
  },

  addBookingTask(table, bookingInfo) {
    return this.add({
      type: 'booking',
      title: `${table.name} - ${table.type}`,
      subtitle: `${bookingInfo.date} ${bookingInfo.time}`,
      amount: table.price * bookingInfo.duration,
      status: 'pending_payment',
      extra: {
        tableId: table.id,
        date: bookingInfo.date,
        time: bookingInfo.time,
        duration: bookingInfo.duration,
        orderNo: bookingInfo.orderNo
      }
    })
  },

  addCourseTask(course, enrollInfo) {
    return this.add({
      type: 'course',
      title: course.name,
      subtitle: '报名成功，等待开课',
      amount: course.price,
      status: 'upcoming',
      extra: {
        courseId: course.id,
        orderNo: enrollInfo.orderNo,
        coach: course.coach,
        lessons: course.lessons
      }
    })
  },

  addCompetitionTask(competition, regInfo) {
    return this.add({
      type: 'competition',
      title: competition.name,
      subtitle: competition.status === 'upcoming' ? '等待比赛开始' : '比赛进行中',
      amount: competition.fee,
      status: competition.status === 'upcoming' ? 'upcoming' : 'ongoing',
      extra: {
        competitionId: competition.id,
        regNo: regInfo.regNo,
        playerNo: regInfo.playerNo,
        date: competition.date
      }
    })
  },

  addOrderTask(order) {
    return this.add({
      type: 'order',
      title: order.items.map(i => i.name).join('、'),
      subtitle: '已下单，待发货',
      amount: order.amount,
      status: 'pending_shipment',
      extra: {
        orderNo: order.orderNo,
        items: order.items,
        createTime: order.createTime
      }
    })
  },

  /**
   * 标记任务已支付，仅限归属人
   */
  markAsPaid(taskId) {
    const task = this.getById(taskId)
    if (!task) return null

    let newStatus = 'upcoming'
    let newSubtitle = '支付成功'

    if (task.type === 'order') {
      newStatus = 'pending_shipment'
      newSubtitle = '支付成功，待发货'
    } else if (task.type === 'course') {
      newSubtitle = '支付成功，等待开课'
    } else if (task.type === 'booking') {
      newSubtitle = '支付成功，等待使用'
    }

    return this.update(taskId, { status: newStatus, subtitle: newSubtitle })
  },

  getPendingCount() {
    return this.getByStatus('pending').length
  },

  getCompletedCount() {
    return this.getByStatus('completed').length
  },

  /**
   * 当前用户的消费统计（全部基于本人任务实时计算）
   * @returns {{totalSpent: number, pendingPaymentCount: number, totalCount: number}}
   */
  getConsumptionStats() {
    const tasks = this.getAll()
    return {
      totalSpent: tasks
        .filter(t => PAID_STATUSES.includes(t.status))
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
      pendingPaymentCount: tasks.filter(t => t.status === 'pending_payment').length,
      totalCount: tasks.length
    }
  },

  // ==================== 积分明细（按用户隔离） ====================

  /**
   * 获取当前用户的积分变动明细
   */
  getPointsRecords() {
    const ns = getNamespace()
    if (!ns) return []
    return [...ns.pointsRecords].sort((a, b) => new Date(b.date) - new Date(a.date))
  },

  /**
   * 追加一条积分变动记录（如积分兑换扣减）
   * @param {{title: string, amount: number, type: 'add'|'minus'}} record
   */
  addPointsRecord(record) {
    const userId = currentUserId()
    if (!userId) {
      logger.warn('未登录，禁止写入积分明细')
      return null
    }

    const ns = getNamespace()
    const newRecord = {
      id: 'P' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
      date: formatDate(new Date()).slice(0, 10),
      title: record.title,
      amount: Number(record.amount) || 0,
      type: record.type === 'add' ? 'add' : 'minus',
      userId
    }
    ns.pointsRecords.unshift(newRecord)

    if (!saveNamespace(ns)) return null
    return { ...newRecord }
  },

  /**
   * 清空当前用户的全部任务数据（不影响其他账户）
   */
  clearAll() {
    const userId = currentUserId()
    if (!userId) return false
    const store = loadStore()
    store.users[userId] = { tasks: [], pointsRecords: [] }
    const ok = saveStore(store)
    if (ok) logger.info('当前用户任务数据已清除', { userId })
    return ok
  }
}

export default taskStore
