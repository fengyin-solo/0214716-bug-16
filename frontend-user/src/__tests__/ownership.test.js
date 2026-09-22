/**
 * 资料归属与展示权限回归测试
 *
 * 覆盖场景：
 * - 任务/订单数据按用户ID隔离（换账号看不到旧账户内容）
 * - 退出登录解绑数据桶
 * - 编辑资料仅白名单字段受控生效，积分/等级等受保护字段无法越权修改
 * - 资料规范化：空资料/缺字段不崩溃
 * - 登录失效（mock token 非法）接口返回 unauthorized
 * - 积分兑换服务端校验余额
 * - 完成任务（确认收货）积分只奖励一次
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  authState,
  login,
  logout,
  initAuth,
  normalizeUser,
  updateCurrentUser,
  isProfileFieldEditable,
  forceLogout
} from '../utils/auth'
import { api } from '../utils/api'
import { taskStore } from '../utils/taskStore'

// localStorage mock（每个用例前重置）
const localStorageMock = {
  store: {},
  getItem: vi.fn(key => (key in localStorageMock.store ? localStorageMock.store[key] : null)),
  setItem: vi.fn((key, value) => { localStorageMock.store[key] = String(value) }),
  removeItem: vi.fn(key => { delete localStorageMock.store[key] }),
  clear: vi.fn(() => { localStorageMock.store = {} })
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true })

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
  authState.isLoggedIn = false
  authState.user = null
  authState.token = null
  authState.error = null
  authState.loading = false
  taskStore.unbindUser()
})

describe('任务数据按账户隔离', () => {
  it('不同账号的任务存储互不影响', () => {
    taskStore.bindUser('U-A')
    taskStore.clearAll()
    taskStore.add({ type: 'order', title: 'A的订单', amount: 100, status: 'pending_shipment', subtitle: '' })
    expect(taskStore.getAll()).toHaveLength(1)

    taskStore.bindUser('U-B')
    expect(taskStore.getAll()).toHaveLength(0)
    taskStore.add({ type: 'booking', title: 'B的预约', amount: 50, status: 'upcoming', subtitle: '' })
    expect(taskStore.getAll()).toHaveLength(1)

    // 切回 A，数据仍在且只有 A 自己的
    taskStore.bindUser('U-A')
    const aTasks = taskStore.getAll()
    expect(aTasks).toHaveLength(1)
    expect(aTasks[0].title).toBe('A的订单')
  })

  it('退出登录后解绑，重新登录另一账号不会读到旧账号订单', async () => {
    await login('user', '123456')
    expect(taskStore.currentUserId).toBe('U20260001')
    const userTasksCount = taskStore.getAll().length
    expect(userTasksCount).toBeGreaterThan(0)

    await logout()
    expect(taskStore.currentUserId).toBeNull()

    await login('lisi', '123456')
    expect(taskStore.currentUserId).toBe('U20260002')
    const lisiTasks = taskStore.getAll()
    expect(lisiTasks).toHaveLength(0)
  })

  it('任务更新不允许篡改 id', () => {
    taskStore.bindUser('U-C')
    taskStore.clearAll()
    const t = taskStore.add({ type: 'order', title: 'x', amount: 1, status: 'shipped', subtitle: '' })
    const updated = taskStore.update(t.id, { id: 'fake-id', status: 'completed' })
    expect(updated.id).toBe(t.id)
    expect(updated.status).toBe('completed')
  })
})

describe('接口归属鉴权（mock）', () => {
  it('无 token 读取任务返回空列表，不泄露演示账号数据', async () => {
    const result = await api.getTasks()
    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
  })

  it('非法 token 访问用户资料返回 unauthorized', async () => {
    const result = await api.updateProfile({ name: '黑客' })
    expect(result.success).toBe(false)
    expect(result.unauthorized).toBe(true)
  })

  it('非法 token 执行任务操作返回 unauthorized', async () => {
    const result = await api.doTaskAction({ taskId: 'x', action: 'cancel' })
    expect(result.success).toBe(false)
    expect(result.unauthorized).toBe(true)
  })

  it('A账号的 token 不能操作B账号的任务', async () => {
    // B 账号创建任务
    await login('lisi', '123456')
    const created = taskStore.add({ type: 'order', title: '李四的订单', amount: 99, status: 'shipped', subtitle: '' })
    await logout()

    // A 登录后尝试操作 B 的任务
    await login('user', '123456')
    const result = await api.doTaskAction({ taskId: created.id, action: 'confirm' })
    // A 的数据桶里没有该任务
    expect(result.data.success).toBe(false)
    expect(taskStore.getById(created.id)).toBeNull()
  })
})

describe('编辑资料受控', () => {
  it('仅白名单字段可编辑，积分/等级/统计等字段受保护', () => {
    expect(isProfileFieldEditable('name')).toBe(true)
    expect(isProfileFieldEditable('phone')).toBe(true)
    expect(isProfileFieldEditable('email')).toBe(true)
    ;['id', 'points', 'level', 'totalHours', 'competitions', 'wins', 'courses', 'totalSpent'].forEach((f) => {
      expect(isProfileFieldEditable(f)).toBe(false)
    })
  })

  it('更新资料接口只接受白名单字段，伪造积分不会生效', async () => {
    const loginRes = await login('user', '123456')
    const pointsBefore = loginRes.user.points

    const result = await api.updateProfile({
      name: '张三改',
      phone: '13900001111',
      points: 999999,
      level: '王者',
      totalSpent: 1,
      id: 'U999'
    })
    expect(result.success).toBe(true)
    expect(result.data.name).toBe('张三改')
    expect(result.data.phone).toBe('13900001111')
    // 越权字段被服务端忽略
    expect(result.data.points).toBe(pointsBefore)
    expect(result.data.level).toBe('黄金')
    expect(result.data.id).toBe('U20260001')
  })

  it('昵称非法时更新失败', async () => {
    await login('lisi', '123456')
    const result = await api.updateProfile({ name: 'x' })
    expect(result.success).toBe(false)
  })
})

describe('积分兑换受控', () => {
  it('积分不足时拒绝兑换', async () => {
    await login('lisi', '123456')
    const result = await api.exchangePoints({ points: 99999, giftName: '豪车' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('积分不足')
  })

  it('兑换成功后积分被扣减且持久化，重新登录仍一致', async () => {
    await login('lisi', '123456')
    const before = (await api.getProfile()).data.points
    const cost = 100
    const result = await api.exchangePoints({ points: cost, giftName: '优惠券' })
    expect(result.success).toBe(true)
    expect(result.data.points).toBe(before - cost)

    await logout()
    await login('lisi', '123456')
    const after = (await api.getProfile()).data
    expect(after.points).toBe(before - cost)
  })
})

describe('完成任务积分奖励', () => {
  it('确认收货按金额奖励积分且只奖励一次', async () => {
    await login('lisi', '123456')
    taskStore.clearAll()
    const t = taskStore.add({ type: 'order', title: '球杆', amount: 200, status: 'shipped', subtitle: '' })
    const profileBefore = (await api.getProfile()).data

    const r1 = await api.doTaskAction({ taskId: t.id, action: 'confirm' })
    expect(r1.success).toBe(true)
    expect(r1.data.success).toBe(true)
    expect(r1.data.pointsAwarded).toBe(200)
    expect(r1.data.points).toBe(profileBefore.points + 200)

    // 任务已完成，再次确认无效
    const r2 = await api.doTaskAction({ taskId: t.id, action: 'confirm' })
    expect(r2.data.success).toBe(false)

    const profileAfter = (await api.getProfile()).data
    expect(profileAfter.points).toBe(profileBefore.points + 200)
  })
})

describe('空资料与损坏会话', () => {
  it('normalizeUser 处理 null/缺字段/错误类型不崩溃', () => {
    expect(normalizeUser(null)).toBeNull()
    expect(normalizeUser(undefined)).toBeNull()
    const safe = normalizeUser({})
    expect(safe.name).toBe('会员')
    expect(safe.points).toBe(0)
    expect(Number.isFinite(safe.totalHours)).toBe(true)
    const withBadTypes = normalizeUser({ id: 'X', points: 'abc', name: 12345 })
    expect(withBadTypes.points).toBe(0)
    expect(withBadTypes.name).toBe('12345')
  })

  it('updateCurrentUser 拒绝写入其他账户的资料', async () => {
    await login('lisi', '123456')
    const result = updateCurrentUser({ id: 'U20260001', name: '张三', points: 9999 })
    expect(result).toBeNull()
    expect(authState.user.name).toBe('李四')
  })

  it('本地存储用户数据损坏时 initAuth 清理而不是恢复', () => {
    localStorageMock.store['billiard_token'] = 't'
    localStorageMock.store['billiard_user'] = '{broken'
    initAuth()
    expect(authState.isLoggedIn).toBe(false)
    expect(authState.user).toBeNull()
  })

  it('forceLogout 清除登录态并通知订阅者', async () => {
    await login('lisi', '123456')
    let reason = ''
    const off = (await import('../utils/auth')).onSessionExpired((r) => { reason = r })
    await forceLogout('登录过期')
    expect(authState.isLoggedIn).toBe(false)
    expect(authState.token).toBeNull()
    expect(reason).toBe('登录过期')
    off()
  })
})
