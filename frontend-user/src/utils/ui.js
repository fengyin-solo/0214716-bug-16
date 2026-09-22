/**
 * 全局界面状态
 *
 * - 统一管理全局登录弹窗（App.vue 挂载），任何页面在登录失效/需要登录时都可唤起
 * - 避免各页面自行维护登录弹窗导致状态不一致
 */
import { reactive } from 'vue'

export const uiState = reactive({
  loginModalVisible: false,
  loginMessage: ''
})

/**
 * 打开全局登录弹窗
 * @param {string} [message] - 提示文案（如登录失效原因）
 */
export function openLoginModal(message = '') {
  uiState.loginMessage = message
  uiState.loginModalVisible = true
}

/**
 * 关闭全局登录弹窗
 */
export function closeLoginModal() {
  uiState.loginModalVisible = false
  uiState.loginMessage = ''
}

export default { uiState, openLoginModal, closeLoginModal }
