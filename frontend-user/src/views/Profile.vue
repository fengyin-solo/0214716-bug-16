<template>
  <div class="profile-page">
    <!-- 未登录：不应到达（有路由守卫），兜底展示登录提示 -->
    <div v-if="!isLoggedIn" class="profile-guest">
      <div class="guest-icon">🔒</div>
      <h2>登录后查看会员资料</h2>
      <p>您的会员信息、积分与订单仅本人可见</p>
      <button class="btn-guest-login" @click="goLogin">去登录</button>
    </div>

    <!-- 资料加载失败/被踢下线 -->
    <div v-else-if="loadError" class="profile-guest">
      <div class="guest-icon">⚠️</div>
      <h2>资料加载失败</h2>
      <p>{{ loadError }}</p>
      <button class="btn-guest-login" @click="loadProfile">重新加载</button>
    </div>

    <template v-else>
    <div class="profile-layout">
      <aside class="profile-sidebar">
        <div class="user-card">
          <div class="user-avatar"><span>{{ avatarInitial }}</span><div class="avatar-ring"></div></div>
          <h2>{{ user.name }}</h2>
          <div class="user-level"><span class="level-badge">{{ user.level }}</span><span class="level-text">会员</span></div>
          <div class="user-id">ID: {{ user.id || '—' }}</div>
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
            <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-content"><span class="stat-value">{{ consumptionDisplay }}</span><span class="stat-label">累计消费(元)</span></div></div>
          </div>
        </section>

        <section class="bookings-section">
          <div class="section-header"><h3>最近订单</h3><button class="btn-view-all" @click="goTasks">查看全部</button></div>
          <div v-if="recentOrders.length" class="bookings-list">
            <div v-for="task in recentOrders" :key="task.id" class="booking-card" @click="viewTaskDetail(task)">
              <div class="booking-type"><span>{{ task.typeIcon }}</span></div>
              <div class="booking-info">
                <h4>{{ task.title }}</h4>
                <p class="booking-time">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  {{ task.createdAt }}
                </p>
              </div>
              <div class="booking-amount">¥{{ Number(task.amount || 0).toLocaleString() }}</div>
              <div class="booking-status" :class="task.statusType">{{ task.statusText }}</div>
            </div>
          </div>
          <div v-else class="empty-orders">
            <span class="empty-orders-icon">📭</span>
            <p>暂无订单记录</p>
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
        <div class="form-group">
          <label>昵称</label>
          <input v-model="editForm.name" type="text" placeholder="请输入昵称" maxlength="20" />
        </div>
        <div class="form-group">
          <label>手机号（选填）</label>
          <input v-model="editForm.phone" type="tel" placeholder="请输入手机号" maxlength="11" />
        </div>
        <div class="form-group">
          <label>邮箱（选填）</label>
          <input v-model="editForm.email" type="email" placeholder="请输入邮箱" maxlength="60" />
        </div>
        <p class="form-tip">会员等级、积分、参赛与消费统计由系统记录，不可自行修改</p>
      </div>
    </Modal>

    <!-- Points History Modal -->
    <Modal v-model="showPointsModal" title="积分明细" size="medium" :show-footer="false">
      <div v-if="pointsHistory.length" class="points-list">
        <div v-for="record in pointsHistory" :key="record.id" class="points-record">
          <div class="record-info"><span class="record-title">{{ record.title }}</span><span class="record-date">{{ record.date }}</span></div>
          <span class="record-amount" :class="record.type">{{ record.type === 'add' ? '+' : '-' }}{{ record.amount }}</span>
        </div>
      </div>
      <div v-else class="empty-orders">
        <span class="empty-orders-icon">🧾</span>
        <p>暂无积分明细</p>
      </div>
    </Modal>

    <!-- Exchange Modal -->
    <Modal v-model="showExchangeModal" icon="🎁" icon-type="info" title="积分兑换" subtitle="选择您想兑换的礼品" size="medium" :show-footer="false">
      <div class="exchange-list">
        <div v-for="gift in gifts" :key="gift.id" class="gift-card">
          <div class="gift-icon">{{ gift.icon }}</div>
          <div class="gift-info"><h4>{{ gift.name }}</h4><span class="gift-points">{{ gift.points }} 积分</span></div>
          <button class="btn-exchange" :disabled="user.points < gift.points" @click="exchangeGift(gift)">兑换</button>
        </div>
      </div>
    </Modal>

    <!-- Task/Order Detail Modal（数据来自当前登录用户的任务存储） -->
    <Modal v-model="showDetailModal" :title="(selectedTask?.typeName || '订单') + '详情'" size="small" :show-cancel="false" confirm-text="关闭" @confirm="showDetailModal = false">
      <div v-if="selectedTask" class="booking-detail">
        <div class="detail-row"><span class="label">任务编号</span><span class="value">{{ selectedTask.id }}</span></div>
        <div class="detail-row"><span class="label">项目名称</span><span class="value">{{ selectedTask.title }}</span></div>
        <div class="detail-row"><span class="label">类型</span><span class="value">{{ selectedTask.typeName }}</span></div>
        <div class="detail-row"><span class="label">创建时间</span><span class="value">{{ selectedTask.createdAt }}</span></div>
        <div class="detail-row"><span class="label">金额</span><span class="value">¥{{ Number(selectedTask.amount || 0).toLocaleString() }}</span></div>
        <div class="detail-row"><span class="label">状态</span><span class="value status" :class="selectedTask.statusType">{{ selectedTask.statusText }}</span></div>
      </div>
    </Modal>

    <!-- Logout Modal -->
    <Modal v-model="showLogoutModal" icon="warning" icon-type="warning" title="确认退出" subtitle="退出后需重新登录才能查看会员资料" size="small" confirm-text="确认退出" confirm-type="danger" @confirm="handleLogout" />

    <!-- Success Modal -->
    <Modal v-model="showSuccessModal" icon="🎉" icon-type="success" :title="successTitle" :subtitle="successMessage" size="small" :show-cancel="false" confirm-text="我知道了" @confirm="showSuccessModal = false" />

    <Toast v-model="showToast" :type="toastType" :title="toastTitle" :message="toastMessage" />
    </template>
  </div>
</template>

<script>
import Modal from '../components/Modal.vue'
import Toast from '../components/Toast.vue'
import {
  authState,
  logout,
  isAuthenticated,
  updateCurrentUser,
  normalizeUser,
  isProfileFieldEditable
} from '../utils/auth'
import { api, logger } from '../utils/api'
import { openLoginModal } from '../utils/ui'
import { taskStore } from '../utils/taskStore'

const EMPTY_PROFILE = () => ({
  id: '',
  name: '会员',
  level: '普通',
  points: 0,
  totalHours: 0,
  competitions: 0,
  wins: 0,
  courses: 0,
  totalSpent: 0,
  phone: '',
  email: ''
})

export default {
  name: 'Profile',
  components: { Modal, Toast },
  data() {
    return {
      activeNav: 'info',
      showEditModal: false,
      showPointsModal: false,
      showExchangeModal: false,
      showDetailModal: false,
      showLogoutModal: false,
      showSuccessModal: false,
      saveLoading: false,
      pointsLoading: false,
      selectedTask: null,
      successTitle: '',
      successMessage: '',
      showToast: false,
      toastType: 'success',
      toastTitle: '',
      toastMessage: '',
      // 页面内展示用的资料快照：初始为空结构，等服务端数据回来后填充，避免显示旧账户内容
      profile: EMPTY_PROFILE(),
      profileLoaded: false,
      loadError: '',
      editForm: { name: '', phone: '', email: '' },
      pointsHistory: [],
      recentOrders: [],
      // 请求序号：快速切换栏目/重新进入时，只接受最后一次请求的结果
      profileReqSeq: 0,
      ordersReqSeq: 0,
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
    isLoggedIn() {
      return isAuthenticated()
    },
    // 已登录但资料尚未返回时，展示本地缓存，保证不出现空白闪烁；不回落到其他账户的数据
    user() {
      if (this.profileLoaded) return this.profile
      return normalizeUser(authState.user) || EMPTY_PROFILE()
    },
    avatarInitial() {
      const name = this.user.name || ''
      return name.trim().charAt(0) || '会'
    },
    pointsDisplay() {
      return Number(this.user.points || 0).toLocaleString()
    },
    consumptionDisplay() {
      return Number(this.user.totalSpent || 0).toLocaleString()
    }
  },
  mounted() {
    if (!this.guardAuth()) return
    this.loadProfile()
    this.loadRecentOrders()
  },
  methods: {
    /** 登录态守卫，失效时唤起全局登录框 */
    guardAuth() {
      if (!isAuthenticated()) {
        logger.warn('Profile accessed without session')
        openLoginModal('请先登录后查看会员资料')
        this.$router.replace('/')
        return false
      }
      return true
    },
    /**
     * 从服务端拉取当前用户资料（token 决定归属）
     * 每次进入页面都刷新，保证编辑资料/完成任务/刷新后与服务端一致
     */
    async loadProfile() {
      if (!this.guardAuth()) return
      const seq = ++this.profileReqSeq
      this.loadError = ''
      const result = await api.getProfile()
      // 快速切换账号/栏目导致的过期响应一律丢弃
      if (seq !== this.profileReqSeq || !isAuthenticated()) return

      if (result.unauthorized) {
        // forceLogout 已由API层触发，这里只防止旧数据渲染
        this.loadError = '登录状态已失效，请重新登录'
        return
      }
      if (result.success) {
        const normalized = normalizeUser(result.data)
        if (normalized && (!authState.user || normalized.id === authState.user.id)) {
          this.profile = normalized
          this.profileLoaded = true
          updateCurrentUser(normalized)
        } else {
          logger.warn('Profile owner mismatch, ignoring response', {
            responseId: normalized?.id,
            currentId: authState.user?.id
          })
          this.loadError = '资料归属异常，请重新登录'
        }
      } else {
        this.loadError = result.error || '资料加载失败，请稍后重试'
      }
    },
    /**
     * 最近订单：只读取当前登录用户自己的任务/订单数据，按时间倒序取5条
     */
    async loadRecentOrders() {
      if (!this.guardAuth()) return
      const seq = ++this.ordersReqSeq
      const result = await api.getTasks()
      if (seq !== this.ordersReqSeq || !isAuthenticated()) return

      if (result.success && Array.isArray(result.data)) {
        this.recentOrders = result.data.slice(0, 5)
      } else if (result.unauthorized) {
        this.recentOrders = []
      } else {
        // 接口失败时退回本地当前用户存储，绝不展示硬编码的他人/示例订单
        this.recentOrders = taskStore.getAll().slice(0, 5)
      }
    },
    openEditModal() {
      if (!this.guardAuth()) return
      // 每次打开都以当前资料回填，避免表单残留旧账户内容
      this.editForm = {
        name: this.user.name === '会员' ? '' : this.user.name,
        phone: this.user.phone || '',
        email: this.user.email || ''
      }
      this.showEditModal = true
    },
    async openPointsModal() {
      if (!this.guardAuth()) return
      this.showPointsModal = true
      this.pointsLoading = true
      const seq = Symbol('points')
      this._pointsSeq = seq
      const result = await api.getPointsHistory()
      if (this._pointsSeq !== seq || !isAuthenticated()) return
      if (result.success && Array.isArray(result.data)) {
        this.pointsHistory = result.data
      }
      this.pointsLoading = false
    },
    handleNavClick(nav) {
      this.activeNav = nav
      if (nav === 'info') {
        this.openEditModal()
      } else if (nav === 'bookings') {
        this.goTasks()
      } else if (nav === 'tasks') {
        this.goTasks()
      }
    },
    goTasks() {
      this.$router.push('/tasks')
    },
    goLogin() {
      openLoginModal('请先登录后查看会员资料')
    },
    async saveProfile() {
      if (!this.guardAuth()) return
      const name = this.editForm.name.trim()
      const phone = this.editForm.phone.trim()
      const email = this.editForm.email.trim()

      if (name.length < 2) {
        this.showNotification('error', '验证失败', '昵称至少需要2个字符')
        return
      }
      if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
        this.showNotification('error', '验证失败', '请输入正确的手机号码')
        return
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this.showNotification('error', '验证失败', '请输入正确的邮箱地址')
        return
      }

      // 仅提交白名单字段，防止越权修改积分/等级/统计
      const payload = { name, phone, email }
      Object.keys(payload).forEach((k) => {
        if (!isProfileFieldEditable(k)) delete payload[k]
      })

      this.saveLoading = true
      const result = await api.updateProfile(payload)
      this.saveLoading = false

      if (result.unauthorized) {
        this.showEditModal = false
        return
      }
      if (result.success) {
        const normalized = normalizeUser(result.data)
        if (normalized && (!authState.user || normalized.id === authState.user.id)) {
          this.profile = normalized
          updateCurrentUser(normalized)
        }
        this.showEditModal = false
        this.showNotification('success', '保存成功', '个人资料已更新')
        logger.info('Profile updated', { fields: Object.keys(payload) })
      } else {
        this.showNotification('error', '保存失败', result.error || '请稍后重试')
      }
    },
    viewTaskDetail(task) {
      this.selectedTask = task
      this.showDetailModal = true
    },
    handleAction(action) {
      if (action.action === 'tasks') {
        this.goTasks()
      } else {
        this.showNotification('info', action.name, '功能开发中，敬请期待')
      }
    },
    async exchangeGift(gift) {
      if (!this.guardAuth()) return
      if (Number(this.user.points || 0) < gift.points) {
        this.showNotification('error', '积分不足', `兑换 ${gift.name} 还需 ${gift.points - this.user.points} 积分`)
        return
      }
      const result = await api.exchangePoints({ points: gift.points, giftName: gift.name })
      if (result.unauthorized) return
      if (result.success) {
        const normalized = normalizeUser(result.data.profile)
        if (normalized && (!authState.user || normalized.id === authState.user.id)) {
          this.profile = normalized
          updateCurrentUser(normalized)
        }
        this.pointsHistory = Array.isArray(result.data.history) ? result.data.history : this.pointsHistory
        this.showExchangeModal = false
        this.successTitle = '兑换成功'
        this.successMessage = `您已成功兑换 ${gift.name}`
        this.showSuccessModal = true
        logger.info('Gift exchanged', { gift: gift.name, points: gift.points })
      } else {
        this.showNotification('error', '兑换失败', result.error || '请稍后重试')
      }
    },
    async handleLogout() {
      this.showLogoutModal = false
      logger.info('User logging out')
      await logout()
      // 清空页面内缓存，杜绝退出后残留旧账户数据
      this.profile = EMPTY_PROFILE()
      this.profileLoaded = false
      this.recentOrders = []
      this.pointsHistory = []
      this.$router.push('/')
    },
    showNotification(type, title, message) {
      this.toastType = type
      this.toastTitle = title
      this.toastMessage = message
      this.showToast = true
    }
  }
}
</script>

<style scoped>
.profile-page { max-width: 1400px; margin: 0 auto; padding: 2rem 3rem 4rem; }
.profile-guest { max-width: 460px; margin: 4rem auto; text-align: center; background: var(--bg-card); border: 1px solid var(--border); border-radius: 24px; padding: 3rem 2rem; }
.guest-icon { font-size: 3rem; margin-bottom: 1rem; }
.profile-guest h2 { font-size: 1.25rem; margin-bottom: 0.5rem; }
.profile-guest p { color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem; }
.btn-guest-login { background: var(--gradient-1); color: var(--bg-dark); border: none; padding: 0.7rem 2rem; border-radius: 10px; font-weight: 600; cursor: pointer; }
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
.stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; }
.stat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 1.5rem; display: flex; align-items: center; gap: 1rem; transition: all 0.3s; }
.stat-card:hover { border-color: rgba(255, 255, 255, 0.15); transform: translateY(-2px); }
.stat-icon { font-size: 2rem; }
.stat-content { display: flex; flex-direction: column; }
.stat-value { font-family: 'Space Grotesk', sans-serif; font-size: 1.75rem; font-weight: 700; color: var(--primary); line-height: 1; }
.stat-label { font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem; }
.bookings-section { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 1.5rem; }
.bookings-list { display: flex; flex-direction: column; gap: 0.75rem; }
.booking-card { display: flex; align-items: center; gap: 1.25rem; padding: 1rem 1.25rem; background: rgba(255, 255, 255, 0.02); border-radius: 14px; transition: all 0.3s; cursor: pointer; }
.booking-card:hover { background: rgba(255, 255, 255, 0.04); }
.booking-type { font-size: 1.5rem; }
.booking-info { flex: 1; min-width: 0; }
.booking-info h4 { font-size: 0.95rem; font-weight: 500; margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.booking-time { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--text-secondary); }
.booking-time svg { width: 14px; height: 14px; }
.booking-amount { font-family: 'Space Grotesk', sans-serif; font-weight: 600; color: var(--text-primary); font-size: 0.95rem; }
.booking-status { padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
.booking-status.upcoming, .booking-status.primary { background: rgba(0, 217, 165, 0.15); color: var(--primary); }
.booking-status.completed, .booking-status.success { background: rgba(108, 117, 125, 0.15); color: #6c757d; }
.booking-status.cancelled { background: rgba(255, 107, 107, 0.15); color: #ff6b6b; }
.booking-status.warning { background: rgba(255, 193, 7, 0.15); color: #ffc107; }
.booking-status.info { background: rgba(79, 172, 254, 0.15); color: #4facfe; }
.empty-orders { text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); }
.empty-orders-icon { font-size: 2rem; display: block; margin-bottom: 0.5rem; opacity: 0.6; }
.actions-section { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 1.5rem; }
.actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; }
.action-card { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; background: rgba(255, 255, 255, 0.02); border-radius: 12px; cursor: pointer; transition: all 0.3s; }
.action-card:hover { background: rgba(255, 255, 255, 0.05); }
.action-icon { font-size: 1.25rem; }
.action-name { flex: 1; font-size: 0.9rem; }
.action-arrow { width: 16px; height: 16px; color: var(--text-muted); transition: transform 0.3s; }
.action-card:hover .action-arrow { transform: translateX(3px); color: var(--primary); }
.edit-form { display: flex; flex-direction: column; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 0.5rem; }
.form-group label { font-size: 0.85rem; color: var(--text-secondary); }
.form-group input { background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem 1rem; color: var(--text-primary); font-size: 0.9rem; }
.form-group input:focus { outline: none; border-color: var(--primary); }
.form-tip { font-size: 0.75rem; color: var(--text-muted); }
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
.detail-row { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.9rem; }
.detail-row .label { color: var(--text-secondary); }
.detail-row .value { font-weight: 500; text-align: right; }
.detail-row .value.status.primary { color: var(--primary); }
.detail-row .value.status.success { color: #6c757d; }
.detail-row .value.status.cancelled { color: #ff6b6b; }
.detail-row .value.status.warning { color: #ffc107; }
.detail-row .value.status.info { color: #4facfe; }
@media (max-width: 1100px) { .stats-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 900px) { .profile-layout { grid-template-columns: 1fr; } .profile-sidebar { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; } .user-card { grid-column: 1 / -1; } .profile-nav { grid-column: 1 / -1; } .actions-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .profile-page { padding: 1rem 1.5rem 3rem; } .profile-sidebar { grid-template-columns: 1fr; } .stats-grid { grid-template-columns: repeat(2, 1fr); } .actions-grid { grid-template-columns: 1fr; } }
</style>
