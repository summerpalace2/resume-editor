/** @file 浏览器应用入口：注册 Pinia 和路由，按基础 → 变体 → 打印的顺序加载样式。 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './styles.css'
import './templates/resume-variants.css'
// 打印规则最后加载；针对同等优先级的选择器，应由打印规则决定导出行为。
import './templates/resume-print.css'

createApp(App).use(createPinia()).use(router).mount('#app')
