<template>
  <div class="profile-page">
    <div class="profile-layout">
      <aside class="profile-sidebar">
        <div class="user-card">
          <div class="user-avatar"><span>{{ avatarChar }}</span><div class="avatar-ring"></div></div>
          <h2>{{ user.name }}</h2>
          <div class="user-level"><span class="level-badge">{{ user.level }}</span><span class="level-text">会员</span></div>
          <div class="user-id">ID: {{ user.id }}</div>
          <button class="btn-edit-profile" @click="openEditModal">编辑资料</button>
        </div>

        <div class="points-card">
          <div class="points-header"><span class="points-label">可用积分</span><button class="points-history" @click="openPointsModal">明细</button></div>
          <div class="points-value">{{ pointsDisplay }}</div>
          <button class="btn-points" @click="showExchangeModal = true">积分兑换</button>
        </div>

        <nav class="profile-nav">
          <a href="#" class="nav-item" :class="{ active: activeNav === 'info' }" @click.prevent="handleNavClick('info')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>个人信息</span>
          </a>
          <a href="#" class="nav-item" :class="{ active: activeNav === 'bookings' }" @click.prevent="handleNavClick('bookings')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <span>我的预约</span>
          </a>
          <a href="#" class="nav-item" :class="{ active: activeNav === 'tasks' }" @click.prevent="handleNavClick('tasks')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            <span>任务中心</span>
          </a>
          <a href="#" class="nav-item" @click.prevent="showLogoutModal = true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>退出登录</span>
          </a>
        </nav>
      </aside>

      <main class="profile-main">
        <section class="stats-section">
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon">⏱️</div><div class="stat-content"><span class="stat-value">{{ user.totalHours }}</span><span class="stat-label">累计打球(小时)</span></div></div>
            <div class="stat-card"><div class="stat-icon">🏆</div><div class="stat-content"><span class="stat-value">{{ user.competitions }}</span><span class="stat-label">参赛次数</span></div></div>
            <div class="stat-card"><div class="stat-icon">🥇</div><div class="stat-content"><span class="stat-value">{{ user.wins }}</span><span class="stat-label">获胜场次</span></div></div>
            <div class="stat-card"><div class="stat-icon">📚</div><div class="stat-content"><span class="stat-value">{{ user.courses }}</span><span class="stat-label">已学课程</span></div></div>
          </div>
        </section>

        <section class="bookings-section">
          <div class="section-header">
            <h3>最近预约</h3>
            <button class="btn-view-all" @click="viewAllBookings">查看全部</button>
          </div>
          <div class="consumption-bar">
            <span class="consumption-item">累计消费 <strong>¥{{ consumption.totalSpent.toLocaleString() }}</strong></span>
            <span class="consumption-item">待付款 <strong>{{ consumption.pendingPaymentCount }}</strong> 笔</span>
            <span class="consumption-item">全部任务 <strong>{{ consumption.totalCount }}</strong> 条</span>
          </div>
          <div class="bookings-list">
            <div v-for="booking in recentBookings" :key="booking.id" class="booking-card" @click="viewBookingDetail(booking)">
              <div v-if="booking.date" class="booking-date"><span class="day">{{ getDay(booking.date) }}</span><span class="month">{{ getMonth(booking.date) }}</span></div>
              <div v-else class="booking-date"><span class="day">--</span><span class="month">未知</span></div>
              <div class="booking-info"><h4>{{ booking.tableName }}</h4><p class="booking-time"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>{{ booking.time || '时段待确认' }}</p></div>
              <div class="booking-status" :class="booking.status">{{ statusText[booking.status] || booking.status }}</div>
            </div>
            <div v-if="recentBookings.length === 0" class="empty-inline">
              <span class="empty-inline-icon">📭</span>
              <p>暂无预约记录</p>
              <button class="btn-empty-action" @click="$router.push('/tables')">去预约球桌</button>
            </div>
          </div>
        </section>

        <section class="actions-section">
          <div class="section-header"><h3>快捷服务</h3></div>
          <div class="actions-grid">
            <div v-for="action in quickActions" :key="action.id" class="action-card" @click="handleAction(action)">
              <div class="action-icon">{{ action.icon }}</div>
              <span class="action-name">{{ action.name }}</span>
              <svg class="action-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          </div>
        </section>
      </main>
    </div>

    <!-- Edit Profile Modal -->
    <Modal v-model="showEditModal" title="编辑资料" size="small" confirm-text="保存" :loading="saveLoading" @confirm="saveProfile">
      <div class="edit-form">
        <div class="edit-notice">仅可修改昵称、手机号和邮箱；会员等级、积分、消费统计由系统记录，不可自行修改。</div>
        <div class="form-group"><label>昵称</label><input v-model="editForm.name" type="text" placeholder="请输入昵称" maxlength="20" /></div>
        <div class="form-group"><label>手机号</label><input v-model="editForm.phone" type="tel" placeholder="请输入手机号" maxlength="11" /></div>
        <div class="form-group"><label>邮箱</label><input v-model="editForm.email" type="email" placeholder="请输入邮箱" maxlength="60" /></div>
      </div>
    </Modal>

    <!-- Points History Modal -->
    <Modal v-model="showPointsModal" title="积分明细" size="medium" :show-footer="false">
      <div v-if="pointsHistory.length > 0" class="points-list">
        <div v-for="record in pointsHistory" :key="record.id" class="points-record">
          <div class="record-info"><span class="record-title">{{ record.title }}</span><span class="record-date">{{ record.date }}</span></div>
          <span class="record-amount" :class="record.type">{{ record.type === 'add' ? '+' : '-' }}{{ record.amount }}</span>
        </div>
      </div>
      <div v-else class="empty-block">
        <span class="empty-block-icon">🧾</span>
        <p>暂无积分变动记录</p>
      </div>
    </Modal>

    <!-- Exchange Modal -->
    <Modal v-model="showExchangeModal" icon="🎁" icon-type="info" title="积分兑换" subtitle="选择您想兑换的礼品" size="medium" :show-footer="false">
      <div class="exchange-list">
        <div v-for="gift in gifts" :key="gift.id" class="gift-card" @click="exchangeGift(gift)">
          <div class="gift-icon">{{ gift.icon }}</div>
          <div class="gift-info"><h4>{{ gift.name }}</h4><span class="gift-points">{{ gift.points }} 积分</span></div>
          <button class="btn-exchange" :disabled="user.points < gift.points">兑换</button>
        </div>
      </div>
    </Modal>

    <!-- Booking Detail Modal -->
    <Modal v-model="showBookingDetailModal" title="预约详情" size="small" :show-cancel="false" :confirm-text="detailConfirmText" :confirm-type="canCancelBooking ? 'danger' : 'primary'" @confirm="handleBookingAction">
      <div v-if="selectedBooking" class="booking-detail">
        <div class="detail-row"><span class="label">预约编号</span><span class="value">{{ selectedBooking.orderNo }}</span></div>
        <div class="detail-row"><span class="label">球桌</span><span class="value">{{ selectedBooking.tableName }}</span></div>
        <div class="detail-row"><span class="label">日期</span><span class="value">{{ selectedBooking.date || '—' }}</span></div>
        <div class="detail-row"><span class="label">时段</span><span class="value">{{ selectedBooking.time || '—' }}</span></div>
        <div class="detail-row"><span class="label">状态</span><span class="value status" :class="selectedBooking.status">{{ statusText[selectedBooking.status] || selectedBooking.status }}</span></div>
      </div>
    </Modal>

    <!-- Logout Modal -->
    <Modal v-model="showLogoutModal" icon="warning" icon-type="warning" title="确认退出" subtitle="您确定要退出登录吗？" size="small" confirm-text="确认退出" confirm-type="danger" @confirm="handleLogout" />

    <!-- Success Modal -->
    <Modal v-model="showSuccessModal" icon="🎉" icon-type="success" :title="successTitle" :subtitle="successMessage" size="small" :show-cancel="false" confirm-text="我知道了" @confirm="showSuccessModal = false" />

    <Toast v-model="showToast" :type="toastType" :title="toastTitle" :message="toastMessage" />
  </div>
</template>

<script>
import Modal from '../components/Modal.vue'
import Toast from '../components/Toast.vue'
import {
  authState,
  logout,
  isAuthenticated,
  updateUserProfile,
  adjustUserPoints
} from '../utils/auth'
import { logger } from '../utils/api'
import { taskStore } from '../utils/taskStore'

// 游客兜底资料：仅用于未登录时的安全渲染（正常情况下路由守卫会拦截）
const GUEST_PROFILE = {
  id: '',
  name: '游客',
  level: '普通',
  points: 0,
  totalHours: 0,
  competitions: 0,
  wins: 0,
  courses: 0,
  phone: '',
  email: ''
}

export default {
  name: 'Profile',
  components: { Modal, Toast },
  data() {
    return {
      activeNav: 'info',
      showEditModal: false,
      showPointsModal: false,
      showExchangeModal: false,
      showBookingDetailModal: false,
      showLogoutModal: false,
      showSuccessModal: false,
      saveLoading: false,
      selectedBooking: null,
      successTitle: '',
      successMessage: '',
      showToast: false,
      toastType: 'success',
      toastTitle: '',
      toastMessage: '',
      editForm: { name: '', phone: '', email: '' },
      // 预约任务状态 -> 展示文案
      statusText: {
        pending_payment: '待付款',
        upcoming: '待使用',
        ongoing: '进行中',
        completed: '已完成',
        cancelled: '已取消'
      },
      // 当前用户名下的预约与消费统计（进入页面时从本人数据加载）
      myBookings: [],
      consumption: { totalSpent: 0, pendingPaymentCount: 0, totalCount: 0 },
      pointsHistory: [],
      quickActions: [
        { id: 1, name: '任务中心', icon: '📋', action: 'tasks' },
        { id: 2, name: '优惠券', icon: '🎫', action: 'coupon' },
        { id: 3, name: '邀请好友', icon: '👥', action: 'invite' },
        { id: 4, name: '意见反馈', icon: '💬', action: 'feedback' },
        { id: 5, name: '帮助中心', icon: '❓', action: 'help' }
      ],
      gifts: [
        { id: 1, name: '10元优惠券', icon: '🎫', points: 200 },
        { id: 2, name: '1小时免费打球', icon: '🎱', points: 500 },
        { id: 3, name: '专业巧克粉', icon: '🧊', points: 300 },
        { id: 4, name: '台球手套', icon: '🧤', points: 800 }
      ]
    }
  },
  computed: {
    user() {
      return authState.user || GUEST_PROFILE
    },
    avatarChar() {
      return (this.user.name || '?').trim().charAt(0).toUpperCase() || '?'
    },
    pointsDisplay() {
      return (Number(this.user.points) || 0).toLocaleString()
    },
    // 最近预约只展示当前登录用户本人的预约任务（最多3条，时间倒序）
    recentBookings() {
      return this.myBookings.slice(0, 3).map(t => ({
        id: t.id,
        orderNo: t.extra?.orderNo || t.id,
        tableName: t.title,
        date: t.extra?.date || (t.createdAt || '').slice(0, 10),
        time: t.extra?.time || '',
        status: t.status
      }))
    },
    canCancelBooking() {
      return this.selectedBooking &&
        (this.selectedBooking.status === 'upcoming' || this.selectedBooking.status === 'pending_payment')
    },
    detailConfirmText() {
      return this.canCancelBooking ? '取消预约' : '关闭'
    }
  },
  mounted() {
    this.loadUserData()
  },
  methods: {
    /**
     * 加载当前登录用户的私有数据
     * taskStore 内部已按用户ID隔离，未登录时返回空集合，不会读到旧账户内容
     */
    loadUserData() {
      this.myBookings = taskStore.getAll().filter(t => t.type === 'booking')
      this.consumption = taskStore.getConsumptionStats()
      this.pointsHistory = taskStore.getPointsRecords()
    },
    getDay(date) {
      const d = new Date(date)
      return isNaN(d.getTime()) ? '--' : d.getDate()
    },
    getMonth(date) {
      const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
      const d = new Date(date)
      return isNaN(d.getTime()) ? '' : months[d.getMonth()]
    },
    handleNavClick(nav) {
      this.activeNav = nav
      if (nav === 'info') {
        this.openEditModal()
      } else if (nav === 'bookings') {
        const pending = this.myBookings.filter(b =>
          b.status === 'upcoming' || b.status === 'pending_payment'
        ).length
        this.showNotification('info', '我的预约', `您有 ${pending} 个待处理的预约`)
      } else if (nav === 'tasks') {
        this.$router.push('/tasks')
      }
    },
    viewAllBookings() {
      this.showNotification('info', '全部预约', `共 ${this.myBookings.length} 条预约记录`)
    },
    openEditModal() {
      if (!isAuthenticated()) {
        this.showNotification('warning', '请先登录', '登录后才可编辑个人资料')
        return
      }
      // 每次打开都从当前用户资料重新同步，避免编辑框残留旧值
      this.editForm = {
        name: this.user.name || '',
        phone: this.user.phone || '',
        email: this.user.email || ''
      }
      this.showEditModal = true
    },
    openPointsModal() {
      // 进入页面后可能产生新的积分变动，打开时重新读取本人明细
      this.pointsHistory = taskStore.getPointsRecords()
      this.showPointsModal = true
    },
    async saveProfile() {
      // 表单验证
      const name = this.editForm.name?.trim() || ''
      if (name.length < 2) {
        this.showNotification('error', '验证失败', '昵称至少需要2个字符')
        return
      }
      const phone = this.editForm.phone?.trim() || ''
      if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
        this.showNotification('error', '验证失败', '请输入正确的手机号码')
        return
      }
      const email = this.editForm.email?.trim() || ''
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this.showNotification('error', '验证失败', '请输入正确的邮箱地址')
        return
      }

      this.saveLoading = true
      await new Promise(resolve => setTimeout(resolve, 600))

      // 通过受控接口修改：仅白名单字段会生效，其余字段无法越权篡改
      const result = updateUserProfile({ name, phone, email })

      this.saveLoading = false

      if (!result.success) {
        // 典型场景：登录已失效
        this.showNotification('error', '保存失败', result.error || '请稍后重试')
        return
      }

      this.showEditModal = false
      this.showNotification('success', '保存成功', '个人资料已更新')
      logger.info('Profile updated', { userId: this.user.id, name })
    },
    viewBookingDetail(booking) {
      this.selectedBooking = booking
      this.showBookingDetailModal = true
    },
    handleBookingAction() {
      if (!this.selectedBooking) {
        this.showBookingDetailModal = false
        return
      }

      if (this.canCancelBooking) {
        // 取消操作落到本人任务存储，taskStore 会再次校验归属
        const result = taskStore.updateStatus(this.selectedBooking.id, 'cancelled')
        if (!result) {
          this.showNotification('error', '操作失败', '预约不存在或登录已失效')
          this.showBookingDetailModal = false
          return
        }
        this.loadUserData()
        this.showBookingDetailModal = false
        this.showNotification('success', '取消成功', '预约已取消')
        logger.info('Booking cancelled', { orderNo: this.selectedBooking.orderNo })
      } else {
        this.showBookingDetailModal = false
      }
    },
    handleAction(action) {
      if (action.action === 'tasks') {
        this.$router.push('/tasks')
      } else {
        this.showNotification('info', action.name, '功能开发中，敬请期待')
      }
    },
    exchangeGift(gift) {
      if (!isAuthenticated()) {
        this.showNotification('warning', '请先登录', '登录后才可兑换礼品')
        return
      }
      // 积分扣减走受控接口（只允许扣减且校验余额），并记录本人的积分明细
      const result = adjustUserPoints(-gift.points, gift.name)
      if (!result.success) {
        this.showNotification('error', '兑换失败', result.error || '积分余额不足')
        return
      }

      taskStore.addPointsRecord({ title: `兑换-${gift.name}`, amount: gift.points, type: 'minus' })
      this.pointsHistory = taskStore.getPointsRecords()

      this.showExchangeModal = false
      this.successTitle = '兑换成功'
      this.successMessage = `您已成功兑换 ${gift.name}`
      this.showSuccessModal = true
      logger.info('Gift exchanged', { gift: gift.name, points: gift.points })
    },
    async handleLogout() {
      this.showLogoutModal = false
      logger.info('User logging out')
      await logout()
      // /login 不是独立页面，退出后回到首页；任务/积分数据均按用户隔离，无需额外清理
      this.$router.push('/')
    },
    showNotification(type, title, message) { this.toastType = type; this.toastTitle = title; this.toastMessage = message; this.showToast = true }
  }
}
</script>

<style scoped>
.profile-page { max-width: 1400px; margin: 0 auto; padding: 2rem 3rem 4rem; }
.profile-layout { display: grid; grid-template-columns: 300px 1fr; gap: 2rem; }
.profile-sidebar { display: flex; flex-direction: column; gap: 1rem; }
.user-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 24px; padding: 2rem; text-align: center; }
.user-avatar { position: relative; width: 100px; height: 100px; margin: 0 auto 1.5rem; }
.user-avatar span { position: absolute; inset: 4px; background: var(--gradient-1); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 700; color: var(--bg-dark); }
.avatar-ring { position: absolute; inset: 0; border: 3px solid var(--primary); border-radius: 50%; animation: rotate 10s linear infinite; border-top-color: transparent; border-left-color: transparent; }
@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.user-card h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
.user-level { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.level-badge { background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: var(--bg-dark); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; }
.level-text { color: var(--text-secondary); font-size: 0.85rem; }
.user-id { color: var(--text-muted); font-size: 0.8rem; font-family: monospace; margin-bottom: 1rem; }
.btn-edit-profile { background: rgba(0, 217, 165, 0.1); border: 1px solid rgba(0, 217, 165, 0.3); color: var(--primary); padding: 0.6rem 1.5rem; border-radius: 10px; font-size: 0.85rem; cursor: pointer; transition: all 0.3s; }
.btn-edit-profile:hover { background: rgba(0, 217, 165, 0.2); }
.points-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 1.5rem; }
.points-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.points-label { color: var(--text-secondary); font-size: 0.85rem; }
.points-history { background: transparent; border: none; color: var(--primary); font-size: 0.8rem; cursor: pointer; }
.points-value { font-family: 'Space Grotesk', sans-serif; font-size: 2.5rem; font-weight: 700; color: var(--primary); margin-bottom: 1rem; }
.btn-points { width: 100%; background: rgba(0, 217, 165, 0.1); border: 1px solid rgba(0, 217, 165, 0.3); color: var(--primary); padding: 0.75rem; border-radius: 10px; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.3s; }
.btn-points:hover { background: rgba(0, 217, 165, 0.2); }
.profile-nav { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 0.75rem; }
.nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem; color: var(--text-secondary); text-decoration: none; border-radius: 12px; transition: all 0.3s; }
.nav-item:hover { background: rgba(255, 255, 255, 0.03); color: var(--text-primary); }
.nav-item.active { background: rgba(0, 217, 165, 0.1); color: var(--primary); }
.nav-item svg { width: 20px; height: 20px; }
.profile-main { display: flex; flex-direction: column; gap: 1.5rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.section-header h3 { font-size: 1.1rem; font-weight: 600; }
.btn-view-all { background: transparent; border: none; color: var(--primary); font-size: 0.85rem; cursor: pointer; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.stat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 1.5rem; display: flex; align-items: center; gap: 1rem; transition: all 0.3s; }
.stat-card:hover { border-color: rgba(255, 255, 255, 0.15); transform: translateY(-2px); }
.stat-icon { font-size: 2rem; }
.stat-content { display: flex; flex-direction: column; }
.stat-value { font-family: 'Space Grotesk', sans-serif; font-size: 1.75rem; font-weight: 700; color: var(--primary); line-height: 1; }
.stat-label { font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem; }
.bookings-section { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 1.5rem; }
.consumption-bar { display: flex; flex-wrap: wrap; gap: 1.5rem; padding: 0.75rem 1rem; margin-bottom: 1rem; background: rgba(0, 217, 165, 0.06); border: 1px solid rgba(0, 217, 165, 0.15); border-radius: 12px; font-size: 0.8rem; color: var(--text-secondary); }
.consumption-item strong { color: var(--primary); font-family: 'Space Grotesk', sans-serif; font-size: 0.95rem; margin: 0 0.15rem; }
.bookings-list { display: flex; flex-direction: column; gap: 0.75rem; }
.booking-card { display: flex; align-items: center; gap: 1.25rem; padding: 1rem 1.25rem; background: rgba(255, 255, 255, 0.02); border-radius: 14px; transition: all 0.3s; cursor: pointer; }
.booking-card:hover { background: rgba(255, 255, 255, 0.04); }
.booking-date { display: flex; flex-direction: column; align-items: center; min-width: 50px; }
.booking-date .day { font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem; font-weight: 700; line-height: 1; }
.booking-date .month { font-size: 0.75rem; color: var(--text-secondary); }
.booking-info { flex: 1; }
.booking-info h4 { font-size: 0.95rem; font-weight: 500; margin-bottom: 0.25rem; }
.booking-time { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--text-secondary); }
.booking-time svg { width: 14px; height: 14px; }
.booking-status { padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
.booking-status.pending_payment { background: rgba(255, 193, 7, 0.15); color: #ffc107; }
.booking-status.upcoming { background: rgba(0, 217, 165, 0.15); color: var(--primary); }
.booking-status.ongoing { background: rgba(79, 172, 254, 0.15); color: #4facfe; }
.booking-status.completed { background: rgba(108, 117, 125, 0.15); color: #6c757d; }
.booking-status.cancelled { background: rgba(255, 107, 107, 0.15); color: #ff6b6b; }
.empty-inline { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 2rem 1rem; color: var(--text-secondary); }
.empty-inline-icon { font-size: 2rem; opacity: 0.7; }
.empty-inline p { font-size: 0.9rem; }
.btn-empty-action { margin-top: 0.25rem; background: rgba(0, 217, 165, 0.1); border: 1px solid rgba(0, 217, 165, 0.3); color: var(--primary); padding: 0.5rem 1.25rem; border-radius: 10px; font-size: 0.85rem; cursor: pointer; }
.btn-empty-action:hover { background: rgba(0, 217, 165, 0.2); }
.empty-block { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 3rem 1rem; color: var(--text-secondary); }
.empty-block-icon { font-size: 2.5rem; opacity: 0.7; }
.actions-section { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 1.5rem; }
.actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; }
.action-card { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; background: rgba(255, 255, 255, 0.02); border-radius: 12px; cursor: pointer; transition: all 0.3s; }
.action-card:hover { background: rgba(255, 255, 255, 0.05); }
.action-icon { font-size: 1.25rem; }
.action-name { flex: 1; font-size: 0.9rem; }
.action-arrow { width: 16px; height: 16px; color: var(--text-muted); transition: transform 0.3s; }
.action-card:hover .action-arrow { transform: translateX(3px); color: var(--primary); }
.edit-form { display: flex; flex-direction: column; gap: 1rem; }
.edit-notice { padding: 0.75rem 1rem; background: rgba(79, 172, 254, 0.08); border: 1px solid rgba(79, 172, 254, 0.2); border-radius: 10px; color: var(--text-secondary); font-size: 0.78rem; line-height: 1.5; }
.form-group { display: flex; flex-direction: column; gap: 0.5rem; }
.form-group label { font-size: 0.85rem; color: var(--text-secondary); }
.form-group input { background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem 1rem; color: var(--text-primary); font-size: 0.9rem; }
.form-group input:focus { outline: none; border-color: var(--primary); }
.points-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 400px; overflow-y: auto; }
.points-record { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(255, 255, 255, 0.03); border-radius: 12px; }
.record-info { display: flex; flex-direction: column; }
.record-title { font-size: 0.9rem; font-weight: 500; }
.record-date { font-size: 0.75rem; color: var(--text-muted); }
.record-amount { font-family: 'Space Grotesk', sans-serif; font-size: 1.1rem; font-weight: 700; }
.record-amount.add { color: var(--primary); }
.record-amount.minus { color: #ff6b6b; }
.exchange-list { display: flex; flex-direction: column; gap: 0.75rem; }
.gift-card { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(255, 255, 255, 0.03); border-radius: 12px; }
.gift-icon { font-size: 2rem; }
.gift-info { flex: 1; }
.gift-info h4 { font-size: 0.95rem; font-weight: 500; margin-bottom: 0.2rem; }
.gift-points { font-size: 0.8rem; color: var(--primary); }
.btn-exchange { background: var(--gradient-1); border: none; color: var(--bg-dark); padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
.btn-exchange:disabled { background: var(--bg-card-hover); color: var(--text-muted); cursor: not-allowed; }
.booking-detail { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; background: rgba(255, 255, 255, 0.03); border-radius: 12px; }
.detail-row { display: flex; justify-content: space-between; font-size: 0.9rem; }
.detail-row .label { color: var(--text-secondary); }
.detail-row .value { font-weight: 500; }
.detail-row .value.status.pending_payment { color: #ffc107; }
.detail-row .value.status.upcoming { color: var(--primary); }
.detail-row .value.status.ongoing { color: #4facfe; }
.detail-row .value.status.completed { color: #6c757d; }
.detail-row .value.status.cancelled { color: #ff6b6b; }
@media (max-width: 1100px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 900px) { .profile-layout { grid-template-columns: 1fr; } .profile-sidebar { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; } .user-card { grid-column: 1 / -1; } .profile-nav { grid-column: 1 / -1; } .actions-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .profile-page { padding: 1rem 1.5rem 3rem; } .profile-sidebar { grid-template-columns: 1fr; } .stats-grid { grid-template-columns: repeat(2, 1fr); } .actions-grid { grid-template-columns: 1fr; } }
</style>
