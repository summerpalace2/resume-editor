/** @file 三个路由页：简历工作区、简历管理、样式设置；切换页面复用同一 store。 */
import { createRouter, createWebHistory } from 'vue-router'
import ResumeWorkspace from './views/ResumeWorkspace.vue'
import ResumeLibrary from './views/ResumeLibrary.vue'
import ResumeSettings from './views/ResumeSettings.vue'
import { useResumeStore } from './stores/resumes'
import { commitActiveEdits } from './services/editLifecycle'
import { nextTick } from 'vue'

/** History 路由；部署静态资源时需将非资源路径回退到 index.html。 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'preview', component: ResumeWorkspace },
    { path: '/resumes', name: 'resumes', component: ResumeLibrary },
    { path: '/settings', name: 'settings', component: ResumeSettings },
  ],
})

// 草稿属于输入组件；卸载页面前先提交，然后等待工作区已知修改的保存。
// 保存失败仍可在同一应用内导航，错误条与未保存的内存文档由根组件保留。
router.beforeEach(async () => {
  const store = useResumeStore()
  if (store.canPersist && !store.conflict) {
    commitActiveEdits()
    await nextTick()
    await store.flush().catch(() => undefined)
  }
})
