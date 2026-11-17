/** @file Vue 响应式数据与浏览器结构化克隆之间的适配入口。 */
import { isProxy, toRaw } from 'vue'

/**
 * 递归剥离各层级的 Vue 响应式代理（如数组过滤/展开时残留在数组内的嵌套 Proxy），
 * 仅处理数组与普通对象，保留循环引用防护及非普通对象的原生类型，确保可安全结构化克隆。
 */
function deepToRaw<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  const raw = isProxy(value) ? toRaw(value) : value
  if (raw === null || typeof raw !== 'object') return raw

  if (seen.has(raw)) return seen.get(raw) as T

  if (Array.isArray(raw)) {
    const out: unknown[] = []
    seen.set(raw, out)
    for (let i = 0; i < raw.length; i++) {
      out.push(deepToRaw(raw[i], seen))
    }
    return out as T
  }

  const proto = Object.getPrototypeOf(raw)
  if (proto === Object.prototype || proto === null) {
    const out: Record<string, unknown> = {}
    seen.set(raw, out)
    for (const key of Object.keys(raw)) {
      out[key] = deepToRaw((raw as Record<string, unknown>)[key], seen)
    }
    return out as T
  }

  return raw
}

/**
 * 脱离各层级 Vue 代理后深复制，避免模板修改直接写入 props 或嵌套代理导致 structuredClone 报错。
 * @param value 由普通对象、数组和可结构化克隆值组成的文档；不支持函数或 DOM。
 */
export function cloneData<T>(value: T): T {
  return structuredClone(deepToRaw(value))
}
