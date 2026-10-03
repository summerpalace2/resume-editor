/** @file Vite 开发/构建配置；Vue 插件负责编译 .vue 文件，当前未配置远程代理。 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})
