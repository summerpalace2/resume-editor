/** @file Vue 响应式数据与浏览器结构化克隆之间的适配入口。 */
import { toRaw } from 'vue'

/**
 * 脱离当前根对象的 Vue 代理后深复制，避免模板修改直接写入 props。
 * @param value 由普通对象、数组和可结构化克隆值组成的文档；不支持函数或 DOM。
 * @returns 与源对象独立的副本。toRaw 只解除根代理，勿传入人为嵌套的代理对象。
 */
export function cloneData<T>(value: T): T {
  return structuredClone(toRaw(value))
}
