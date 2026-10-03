/** @file 串行、防抖的保存调度；不依赖 Vue、DOM 或具体数据库。 */
export type SaveState = 'loading' | 'saved' | 'saving' | 'error'

export interface SaveQueueOptions<T> {
  snapshot: () => T
  write: (snapshot: T) => Promise<void>
  enabled: () => boolean
  onState: (state: SaveState, error?: unknown) => void
  delay?: number
}

/**
 * dirty/committed 使用内存修改序号；数据库修订号由调用方单独维护。
 * 旧写入完成后只提交它取得快照时的序号，新修改继续排队，不误报 saved。
 */
export function createSaveQueue<T>(options: SaveQueueOptions<T>) {
  let dirty = 0
  let committed = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight: Promise<void> | undefined

  function clearTimer(): void {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }

  function markDirty(): void {
    dirty += 1
    clearTimer()
    if (!options.enabled()) {
      options.onState('error', new Error('当前工作区尚未允许写回。'))
      return
    }
    options.onState('saving')
    timer = setTimeout(() => {
      void flush().catch(() => undefined)
    }, options.delay ?? 350)
  }

  async function drain(): Promise<void> {
    try {
      while (committed < dirty) {
        if (!options.enabled()) throw new Error('当前工作区尚未允许写回。')
        const revision = dirty
        const snapshot = options.snapshot()
        await options.write(snapshot)
        committed = revision
      }
      options.onState('saved')
    } catch (error) {
      options.onState('error', error)
      throw error
    }
  }

  /** 立即排空所有已提交到工作区的修改；共享正在执行的 Promise，避免并发写入。 */
  async function flush(): Promise<void> {
    clearTimer()
    if (inFlight) await inFlight
    if (committed === dirty) return
    options.onState('saving')
    inFlight = drain()
    try {
      await inFlight
    } finally {
      inFlight = undefined
    }
    if (committed < dirty) await flush()
  }

  /** 仅成功重读工作区后调用；存在写入时禁止重置修订。 */
  function reset(): void {
    if (inFlight) throw new Error('保存尚未结束，不能重置工作区。')
    clearTimer()
    dirty = 0
    committed = 0
  }

  return { markDirty, flush, reset, hasPending: () => committed < dirty }
}
