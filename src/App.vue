<script setup lang="ts">
/** @file 唯一读取入口与恢复界面；离开页面前提交草稿并请求立即保存。 */
import { onMounted, onUnmounted, watch } from 'vue'
import { useResumeStore } from './stores/resumes'
import { createBackup, downloadJson } from './storage/backup'
import { commitActiveEdits } from './services/editLifecycle'

const store = useResumeStore()

// 冲突界面替换路由前提交活动草稿，只保留在内存中供下载备份。
watch(
  () => store.conflict,
  (conflict) => {
    if (conflict) commitActiveEdits()
  },
  { flush: 'sync' },
)

function backupMemory(): void {
  commitActiveEdits()
  downloadJson(`简历工坊恢复备份-${Date.now()}.json`, createBackup(store.resumes))
}

/** 重读可能放弃内存中的未保存内容，恢复按钮必须明确提醒并保留下载入口。 */
async function reloadWorkspace(): Promise<void> {
  if (
    store.hasUnsavedChanges &&
    !window.confirm('重新读取会放弃当前尚未保存的修改。请先下载备份，确定继续吗？')
  )
    return
  await store.initialize()
}

function flushInBackground(): void {
  if (!store.canPersist || store.conflict) return
  commitActiveEdits()
  void store.flush().catch(() => undefined)
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') flushInBackground()
}

/** 浏览器关闭时异步写入没有保证；尚未保存的修改触发浏览器原生离开确认。 */
function beforeUnload(event: BeforeUnloadEvent): void {
  flushInBackground()
  if (store.hasUnsavedChanges) {
    event.preventDefault()
    event.returnValue = ''
  }
}

onMounted(() => {
  if (!store.ready) void store.initialize()
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', flushInBackground)
  window.addEventListener('beforeunload', beforeUnload)
})
onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('pagehide', flushInBackground)
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>

<template>
  <template v-if="store.ready && store.canPersist && !store.conflict">
    <aside
      v-if="store.saveState === 'error'"
      class="storage-notice no-print"
      role="alert"
    >
      <span>{{ store.saveErrorMessage }} 当前修改仍留在页面中。</span>
      <button class="button button-quiet" @click="flushInBackground">重试保存</button>
      <button class="button button-quiet" @click="backupMemory">下载备份</button>
    </aside>
    <RouterView />
  </template>
  <main v-else-if="store.ready && store.saveState === 'error'" class="recovery-shell">
    <div class="loading-mark">R</div>
    <h1>{{ store.conflict ? '检测到其他页面的新修改' : '暂时无法读取本地简历' }}</h1>
    <p>{{ store.saveErrorMessage }}</p>
    <p>原有本地简历会保留，请重试或先备份当前修改。</p>
    <div class="recovery-actions">
      <button
        v-if="store.resumes.length"
        class="button button-quiet"
        @click="backupMemory"
      >
        备份当前页面的修改
      </button>
      <button class="button button-primary" @click="reloadWorkspace">
        {{ store.conflict ? '重新读取' : '重试读取' }}
      </button>
    </div>
  </main>
  <main v-else class="loading-shell">
    <div class="loading-mark">R</div>
    <p>正在打开你的简历…</p>
  </main>
</template>
