/**
 * 用户资料受控访问测试
 *
 * 测试范围：
 * - 资料修改白名单（敏感字段不可篡改）
 * - 修改持久化（刷新后仍为本人最新资料）
 * - 积分只能通过受控流程扣减且校验余额
 * - 未登录时一切受控修改被拒绝
 * - 重新登录清理旧会话，避免账户数据串用
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  authState,
  login,
  logout,
  initAuth,
  updateUserProfile,
  adjustUserPoints
} from '../utils/auth'

beforeEach(() => {
  localStorage.clear()
  authState.isLoggedIn = false
  authState.user = null
  authState.token = null
  authState.error = null
  authState.loading = false
})

describe('受控资料修改', () => {
  it('只允许修改白名单字段，敏感字段被忽略', async () => {
    await login('user', '123456')

    const result = updateUserProfile({
      name: '李四',
      phone: '13900001111',
      email: 'lisi@example.com',
      // 以下字段不应被接受
      id: 'HACKED',
      points: 999999,
      level: '钻石',
      totalHours: 9999
    })

    expect(result.success).toBe(true)
    expect(authState.user.name).toBe('李四')
    expect(authState.user.phone).toBe('13900001111')
    expect(authState.user.email).toBe('lisi@example.com')
    // 敏感字段保持原值
    expect(authState.user.id).toBe('U20260001')
    expect(authState.user.points).toBe(2580)
    expect(authState.user.level).toBe('黄金')
    expect(authState.user.totalHours).toBe(156)
  })

  it('修改后的资料持久化到 localStorage，刷新（重新初始化）后保持一致', async () => {
    await login('user', '123456')
    updateUserProfile({ name: '王五', phone: '13800002222', email: '' })

    // 模拟刷新：重置内存状态后从存储恢复
    authState.isLoggedIn = false
    authState.user = null
    authState.token = null
    initAuth()

    expect(authState.isLoggedIn).toBe(true)
    expect(authState.user.name).toBe('王五')
    expect(authState.user.phone).toBe('13800002222')
  })

  it('未登录时拒绝修改资料', () => {
    const result = updateUserProfile({ name: '黑客' })
    expect(result.success).toBe(false)
    expect(authState.user).toBeNull()
  })

  it('不包含任何白名单字段时拒绝更新', async () => {
    await login('user', '123456')
    const result = updateUserProfile({ points: 1, level: '钻石' })
    expect(result.success).toBe(false)
    expect(authState.user.points).toBe(2580)
  })
})

describe('受控积分调整', () => {
  it('允许余额充足时扣减积分并持久化', async () => {
    await login('user', '123456')
    const result = adjustUserPoints(-500, '兑换礼品')
    expect(result.success).toBe(true)
    expect(authState.user.points).toBe(2080)

    authState.isLoggedIn = false
    authState.user = null
    authState.token = null
    initAuth()
    expect(authState.user.points).toBe(2080)
  })

  it('积分不足时拒绝扣减', async () => {
    await login('user', '123456')
    const result = adjustUserPoints(-100000)
    expect(result.success).toBe(false)
    expect(authState.user.points).toBe(2580)
  })

  it('拒绝通过正数直接增加积分', async () => {
    await login('user', '123456')
    const result = adjustUserPoints(1000)
    expect(result.success).toBe(false)
    expect(authState.user.points).toBe(2580)
  })

  it('未登录时拒绝调整积分', () => {
    expect(adjustUserPoints(-1).success).toBe(false)
  })
})

describe('重新登录的会话隔离', () => {
  it('登录前若存在旧会话，先清理再建立新会话', async () => {
    await login('user', '123456')
    updateUserProfile({ name: '旧名字' })
    expect(authState.isLoggedIn).toBe(true)

    // 再次登录（模拟切换账户/重新登录）
    await login('user', '123456')
    expect(authState.isLoggedIn).toBe(true)
    // 新会话返回的是账户原始资料而不是旧会话的脏数据
    expect(authState.user.name).toBe('张三')
  })

  it('退出后无法再修改资料', async () => {
    await login('user', '123456')
    await logout()
    expect(updateUserProfile({ name: 'x' }).success).toBe(false)
    expect(adjustUserPoints(-1).success).toBe(false)
  })
})
