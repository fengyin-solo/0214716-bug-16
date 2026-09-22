/**
 * 任务/订单数据归属测试
 *
 * 测试范围：
 * - 未登录读返回空、写被拒绝
 * - 任务强制归属当前用户
 * - 无法读取/修改/删除不属于自己的任务
 * - 旧版本无归属数据被废弃，不会显示为任何账户的内容
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { authState, login, logout } from '../utils/auth'
import taskStore from '../utils/taskStore'

function loginAs(userId, name) {
  // 复用登录流程后替换为不同的用户身份，模拟多账户
  return login('user', '123456').then(() => {
    authState.user = { ...authState.user, id: userId, name }
    localStorage.setItem('billiard_user', JSON.stringify(authState.user))
  })
}

function makeTask(overrides = {}) {
  return {
    type: 'booking',
    title: '3号球桌 - 美式九球',
    subtitle: '2026-03-01 10:00 - 12:00',
    amount: 120,
    status: 'pending_payment',
    extra: { orderNo: 'BK1', ...overrides.extra },
    ...overrides
  }
}

beforeEach(async () => {
  localStorage.clear()
  authState.isLoggedIn = false
  authState.user = null
  authState.token = null
  authState.error = null
  authState.loading = false
})

describe('未登录访问控制', () => {
  it('未登录时 getAll 返回空数组', () => {
    expect(taskStore.getAll()).toEqual([])
    expect(taskStore.getByStatus('pending')).toEqual([])
    expect(taskStore.getConsumptionStats()).toEqual({
      totalSpent: 0,
      pendingPaymentCount: 0,
      totalCount: 0
    })
  })

  it('未登录时新增任务被拒绝（返回 null）', () => {
    expect(taskStore.add(makeTask())).toBeNull()
    expect(taskStore.getAll()).toEqual([])
  })

  it('未登录时更新/删除均失败', () => {
    expect(taskStore.update('T1', { status: 'completed' })).toBeNull()
    expect(taskStore.remove('T1')).toBe(false)
    expect(taskStore.markAsPaid('T1')).toBeNull()
    expect(taskStore.clearAll()).toBe(false)
  })
})

describe('任务归属隔离', () => {
  it('新增任务强制标记当前用户ID，忽略调用方传入的 userId', async () => {
    await loginAs('U-A', '用户A')
    const task = taskStore.add(makeTask({ userId: 'U-B' }))

    expect(task).not.toBeNull()
    expect(task.userId).toBe('U-A')
    expect(taskStore.getAll()).toHaveLength(1)
  })

  it('不同用户互不可见对方的任务', async () => {
    await loginAs('U-A', '用户A')
    const taskA = taskStore.add(makeTask({ title: '用户A的预约' }))
    expect(taskA).not.toBeNull()

    await logout()
    await loginAs('U-B', '用户B')

    // B 看不到 A 的任务，统计也不包含 A 的消费
    expect(taskStore.getAll()).toEqual([])
    expect(taskStore.getById(taskA.id)).toBeNull()
    expect(taskStore.getConsumptionStats().totalSpent).toBe(0)
  })

  it('用户不能更新或删除他人的任务', async () => {
    await loginAs('U-A', '用户A')
    const taskA = taskStore.add(makeTask())

    await logout()
    await loginAs('U-B', '用户B')

    expect(taskStore.update(taskA.id, { status: 'completed' })).toBeNull()
    expect(taskStore.updateStatus(taskA.id, 'completed')).toBeNull()
    expect(taskStore.markAsPaid(taskA.id)).toBeNull()
    expect(taskStore.remove(taskA.id)).toBe(false)

    // A 的任务依然存在且状态未变
    await logout()
    await loginAs('U-A', '用户A')
    expect(taskStore.getById(taskA.id).status).toBe('pending_payment')
  })

  it('归属人可以正常支付、完成、删除自己的任务', async () => {
    await loginAs('U-A', '用户A')
    const task = taskStore.add(makeTask())

    const paid = taskStore.markAsPaid(task.id)
    expect(paid.status).toBe('upcoming')

    taskStore.updateStatus(task.id, 'completed')
    expect(taskStore.getById(task.id).status).toBe('completed')

    expect(taskStore.remove(task.id)).toBe(true)
    expect(taskStore.getAll()).toHaveLength(0)
  })

  it('无法通过更新接口篡改任务归属', async () => {
    await loginAs('U-A', '用户A')
    const task = taskStore.add(makeTask())

    taskStore.update(task.id, { userId: 'U-B', id: 'FAKE' })
    const stored = taskStore.getById(task.id)
    expect(stored.userId).toBe('U-A')
    expect(stored.id).toBe(task.id)
  })

  it('消费统计只统计本人已支付任务', async () => {
    await loginAs('U-A', '用户A')
    taskStore.add(makeTask({ amount: 100, status: 'pending_payment' }))
    taskStore.add(makeTask({ amount: 200, status: 'upcoming' }))
    taskStore.add({ ...makeTask({ amount: 300, status: 'completed' }), type: 'order' })

    const stats = taskStore.getConsumptionStats()
    expect(stats.totalSpent).toBe(500)
    expect(stats.pendingPaymentCount).toBe(1)
    expect(stats.totalCount).toBe(3)
  })
})

describe('积分明细归属', () => {
  it('积分明细按用户隔离', async () => {
    await loginAs('U-A', '用户A')
    taskStore.addPointsRecord({ title: '兑换-优惠券', amount: 200, type: 'minus' })
    expect(taskStore.getPointsRecords()).toHaveLength(1)

    await logout()
    expect(taskStore.getPointsRecords()).toEqual([])

    await loginAs('U-B', '用户B')
    expect(taskStore.getPointsRecords()).toEqual([])
    // B 登录后只能写自己的明细，且看不到 A 的记录
    taskStore.addPointsRecord({ title: 'B的兑换', amount: 1, type: 'minus' })
    expect(taskStore.getPointsRecords()).toHaveLength(1)
    expect(taskStore.getPointsRecords()[0].title).toBe('B的兑换')

    await logout()
    await loginAs('U-A', '用户A')
    expect(taskStore.getPointsRecords()).toHaveLength(1)
    expect(taskStore.getPointsRecords()[0].title).toBe('兑换-优惠券')
  })
})

describe('旧版本无归属数据处理', () => {
  it('旧数组格式数据被废弃，不会出现在任何账户下', async () => {
    localStorage.setItem(
      'billiard_user_tasks',
      JSON.stringify([makeTask({ id: 'OLD-1' })])
    )

    await loginAs('U-A', '用户A')
    expect(taskStore.getAll()).toEqual([])
    expect(taskStore.getById('OLD-1')).toBeNull()

    // 存储已迁移为按用户隔离的结构
    const raw = JSON.parse(localStorage.getItem('billiard_user_tasks'))
    expect(Array.isArray(raw)).toBe(false)
    expect(raw.users).toBeDefined()
  })
})
