/**
 * 任务中心存储管理
 * 统一管理预约、报名、订单等任务数据，使用 localStorage 持久化
 *
 * 数据归属：
 * - 所有任务按用户ID分桶存储（billiard_user_tasks:<userId>），不同账号互不可见
 * - 未绑定时使用临时桶，登录后必须通过 bindUser 切换到当前账号
 * - 退出登录时调用 unbindUser，防止下一账号看到上一账号内容
 */

const STORAGE_PREFIX = 'billiard_user_tasks'
const LEGACY_STORAGE_KEY = 'billiard_user_tasks'
const DEMO_USER_ID = 'U20260001'

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

/** 当前绑定的用户ID，null 表示匿名/未登录会话 */
let currentUserId = null

/**
 * 绑定当前登录用户，后续读写都限定在该用户的数据桶内
 * @param {string} userId
 */
function bindUser(userId) {
  const nextId = userId ? String(userId) : null
  if (currentUserId !== nextId) {
    currentUserId = nextId
    logger.info('任务存储已切换到用户', currentUserId || '(匿名)')
  }
}

/**
 * 解绑用户（退出登录时调用），清空对账户数据桶的引用
 */
function unbindUser() {
  if (currentUserId !== null) {
    logger.info('任务存储已解绑用户', currentUserId)
  }
  currentUserId = null
}

function storageKey() {
  return currentUserId ? `${STORAGE_PREFIX}:${currentUserId}` : `${STORAGE_PREFIX}:anonymous`
}

function loadTasks() {
  try {
    const key = storageKey()
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed : getDefaultTasks()
    }
    // 首次使用该桶：仅演示账号生成示例任务，其他账号（含匿名）为空，避免串号
    const defaults = getDefaultTasks()
    saveTasks(defaults)
    return defaults
  } catch (e) {
    logger.error('加载任务失败', e)
    return getDefaultTasks()
  }
}

function saveTasks(tasks) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(tasks))
    return true
  } catch (e) {
    logger.error('保存任务失败', e)
    return false
  }
}

/**
 * 清理历史遗留的全局任务数据（未按用户隔离的旧版本数据）
 * 防止旧数据在新账号上被误读
 */
function purgeLegacyTasks() {
  try {
    if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      logger.info('已清理未按用户隔离的历史任务数据')
    }
  } catch (e) {
    logger.warn('清理历史任务数据失败', e)
  }
}

function getDefaultTasks() {
  // 只有演示账号带示例数据；真实新账号/空资料账号应看到空列表
  if (currentUserId !== DEMO_USER_ID) {
    return []
  }
  const ts = Date.now()
  return [
    {
      id: 'T' + ts + '001',
      type: 'booking',
      title: '3号球桌 - 美式九球',
      subtitle: '2026-02-15 14:00 - 16:00',
      amount: 120,
      status: 'pending_payment',
      createdAt: formatDate(new Date(Date.now() - 86400000)),
      extra: { tableId: 3, date: '2026-02-15', time: '14:00 - 16:00' }
    },
    {
      id: 'T' + ts + '002',
      type: 'course',
      title: '台球入门基础课',
      subtitle: '报名成功，等待开课',
      amount: 599,
      status: 'upcoming',
      createdAt: formatDate(new Date(Date.now() - 259200000)),
      extra: { courseId: 1 }
    },
    {
      id: 'T' + ts + '003',
      type: 'competition',
      title: '周末九球挑战赛',
      subtitle: '比赛进行中',
      amount: 100,
      status: 'ongoing',
      createdAt: formatDate(new Date(Date.now() - 432000000)),
      extra: { competitionId: 2 }
    },
    {
      id: 'T' + ts + '004',
      type: 'order',
      title: 'LP专业斯诺克球杆',
      subtitle: '待发货',
      amount: 2999,
      status: 'pending_shipment',
      createdAt: formatDate(new Date(Date.now() - 172800000)),
      extra: { orderNo: 'SP' + String(ts).slice(-8), productId: 1 }
    }
  ]
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
  /** 当前绑定的用户ID（测试/调试用） */
  get currentUserId() {
    return currentUserId
  },

  bindUser,
  unbindUser,
  purgeLegacyTasks,

  getAll() {
    const tasks = loadTasks()
    return tasks.map(enrichTask).sort((a, b) =>
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

  getById(taskId) {
    const tasks = loadTasks()
    const task = tasks.find(t => t.id === taskId)
    return task ? enrichTask(task) : null
  },

  add(taskData) {
    const tasks = loadTasks()
    const newTask = {
      id: generateTaskId(),
      createdAt: formatDate(new Date()),
      ...taskData
    }
    tasks.unshift(newTask)
    saveTasks(tasks)
    logger.info('任务已添加', newTask)
    return enrichTask(newTask)
  },

  update(taskId, updates) {
    const tasks = loadTasks()
    const index = tasks.findIndex(t => t.id === taskId)
    if (index === -1) {
      logger.warn('任务不存在', taskId)
      return null
    }
    // 不允许通过更新篡改任务归属类型与编号
    const safeUpdates = { ...updates }
    delete safeUpdates.id
    delete safeUpdates.userId
    tasks[index] = { ...tasks[index], ...safeUpdates }
    saveTasks(tasks)
    logger.info('任务已更新', taskId, safeUpdates)
    return enrichTask(tasks[index])
  },

  updateStatus(taskId, newStatus) {
    const statusInfo = statusConfig[newStatus]
    if (!statusInfo) {
      logger.error('无效的状态', newStatus)
      return null
    }
    return this.update(taskId, { status: newStatus })
  },

  remove(taskId) {
    const tasks = loadTasks()
    const filtered = tasks.filter(t => t.id !== taskId)
    if (filtered.length === tasks.length) {
      logger.warn('任务不存在，无法删除', taskId)
      return false
    }
    saveTasks(filtered)
    logger.info('任务已删除', taskId)
    return true
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

  clearAll() {
    saveTasks([])
    logger.info('当前用户的所有任务已清除')
  }
}

export default taskStore
