<!--
  App.vue - 应用根组件
  
  功能说明：
  - 整合全局导航栏(NavBar)和页脚(FooterBar)组件
  - 管理路由视图和页面过渡动画
  - 处理全局登录弹窗状态
  
  组件结构：
  - NavBar: 顶部导航栏
  - router-view: 页面内容区域
  - FooterBar: 底部页脚
  - LoginModal: 登录弹窗
-->
<template>
  <div id="app">
    <!-- 导航栏组件 -->
    <NavBar 
      :is-logged-in="isLoggedIn" 
      :user-name="userName"
      @login-click="openLogin"
    />
    
    <!-- 主内容区域 -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    
    <!-- 页脚组件 -->
    <FooterBar />

    <!-- 登录弹窗 -->
    <LoginModal v-model="showLoginModal" @success="onLoginSuccess" />

    <!-- 全局提示（登录失效等） -->
    <Toast
      v-model="showToast"
      :type="toastType"
      :title="toastTitle"
      :message="toastMessage"
    />
  </div>
</template>

<script>
/**
 * 应用根组件
 * 负责整合全局布局组件和管理登录状态
 */
import { authState, isAuthenticated, onSessionExpired } from './utils/auth'
import { logger } from './utils/api'
import NavBar from './components/NavBar.vue'
import FooterBar from './components/FooterBar.vue'
import LoginModal from './components/LoginModal.vue'
import Toast from './components/Toast.vue'

export default {
  name: 'App',
  components: {
    NavBar,
    FooterBar,
    LoginModal,
    Toast
  },
  data() {
    return {
      showLoginModal: false, // 登录弹窗显示状态
      showToast: false,
      toastType: 'warning',
      toastTitle: '',
      toastMessage: ''
    }
  },
  computed: {
    /**
     * 获取用户登录状态
     * @returns {boolean} 是否已登录
     */
    isLoggedIn() {
      return authState.isLoggedIn
    },
    /**
     * 获取用户名称
     * @returns {string} 用户名，默认'U'
     */
    userName() {
      return authState.user?.name || 'U'
    }
  },
  mounted() {
    // 路由守卫（未登录访问受保护页面）会携带 login=1 回到首页并要求登录
    this.unwatchLoginQuery = this.$router.beforeResolve((to) => {
      if (to.query.login === '1' && !isAuthenticated()) {
        this.openLogin()
      }
    })

    // 会话失效（401、跨标签页退出、凭证损坏）：统一回到首页并引导重新登录
    this.unsubscribeSessionExpired = onSessionExpired(({ reason }) => {
      logger.info('Handling session expired', { reason })
      const messageMap = {
        unauthorized: '登录已失效，请重新登录',
        cross_tab_logout: '您已在其他页面退出登录',
        invalid_storage: '登录信息异常，请重新登录'
      }
      this.showToastMessage('warning', '登录状态异常', messageMap[reason] || '请重新登录')

      if (this.$route.path !== '/') {
        this.$router.replace('/')
      }
      // 等路由离开受保护页面后再弹窗
      setTimeout(() => this.openLogin(), 0)
    })
  },
  beforeUnmount() {
    this.unwatchLoginQuery?.()
    this.unsubscribeSessionExpired?.()
  },
  methods: {
    /**
     * 打开登录弹窗
     */
    openLogin() {
      if (isAuthenticated()) return
      this.showLoginModal = true
    },
    /**
     * 登录成功回调
     * 若登录前正在访问受保护页面，登录后跳回原目标
     */
    onLoginSuccess() {
      const redirect = this.$route.query.redirect
      if (redirect && typeof redirect === 'string' && redirect.startsWith('/')) {
        this.$router.replace(redirect).catch(() => {})
      } else if (this.$route.query.login || this.$route.query.redirect) {
        // 清理登录引导参数，避免刷新或回退时重复弹窗
        this.$router.replace({ path: this.$route.path, query: {} }).catch(() => {})
      }
    },
    showToastMessage(type, title, message) {
      this.toastType = type
      this.toastTitle = title
      this.toastMessage = message
      this.showToast = true
    }
  }
}
</script>

<style>
/* 
 * 全局样式
 * 包含CSS变量定义、基础重置、页面过渡动画和滚动条样式
 */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap');

/* 基础重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* CSS变量 - 主题色彩系统 */
:root {
  /* 主色调 */
  --primary: #00D9A5;
  --primary-dark: #00B88A;
  --primary-glow: rgba(0, 217, 165, 0.3);
  
  /* 背景色 */
  --bg-dark: #0A0A0F;
  --bg-card: #12121A;
  --bg-card-hover: #1A1A25;
  
  /* 文字色 */
  --text-primary: #FFFFFF;
  --text-secondary: #8A8A9A;
  --text-muted: #5A5A6A;
  
  /* 边框和渐变 */
  --border: rgba(255, 255, 255, 0.08);
  --gradient-1: linear-gradient(135deg, #00D9A5 0%, #00B4D8 100%);
  --gradient-2: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --shadow-glow: 0 0 60px rgba(0, 217, 165, 0.15);
}

/* 全局body样式 */
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg-dark);
  color: var(--text-primary);
  min-height: 100vh;
  overflow-x: hidden;
  line-height: 1.6;
}

/* 应用容器 */
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 主内容区域 */
.main-content {
  flex: 1;
  padding-top: 100px;
}

/* 页面过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-dark);
}

::-webkit-scrollbar-thumb {
  background: var(--bg-card-hover);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
