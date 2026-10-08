<script setup lang="ts">
/** @file 多份简历管理页面：选择、新建、复制、删除以及整份工作区备份。 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createBackup, downloadJson } from '../storage/backup'
import { useResumeStore } from '../stores/resumes'
import TemplateThumbnail from '../components/TemplateThumbnail.vue'
import { getResumeTemplate } from '../data/templates'

const store = useResumeStore()
const router = useRouter()
const importInput = ref<HTMLInputElement | null>(null)
/** 先复制再按修改时间降序排列，不把展示排序反写到 store 的源数组。 */
const resumesSorted = computed(() =>
  [...store.resumes].sort((a, b) => b.updatedAt - a.updatedAt),
)

/** 通过业务动作改名，保证管理页日期和排序立即对应本次修改。 */
function renameResume(id: string, event: Event): void {
  if (event.target instanceof HTMLInputElement) store.renameResume(id, event.target.value)
}

/** @param value Unix 毫秒时间戳，按本机时区显示中文日期。 */
function formatDate(value: number): string {
  return new Date(value).toLocaleDateString('zh-CN')
}

/** 先切换 store 中的当前 ID，再进入工作区，以保证画布拿到正确文档。 */
function openResume(id: string): void {
  store.setActive(id)
  void router.push('/')
}

/** 文档创建委托给 store；此处仅安排页面跳转。 */
function createResume(): void {
  store.createNew()
  void router.push('/')
}

/** 找到原文档并生成副本后进入工作区，未知 ID 不跳转。 */
function duplicateResume(id: string): void {
  const copy = store.duplicate(id)
  if (copy) void router.push('/')
}

/** 删除确认属于界面职责；选择回退和保存由 store 处理。 */
function deleteResume(id: string): void {
  if (!window.confirm('确定删除这份简历吗？这个操作无法撤销。')) return
  store.remove(id)
}

/** 备份 store 中的全部文档，而不是仅导出当前简历或画廊的展示顺序。 */
function exportBackup(): void {
  const backup = createBackup(store.resumes)
  downloadJson(`简历工坊备份-${new Date().toISOString().slice(0, 10)}.json`, backup)
}

/** 交给 store 校验并合并，反馈结果；finally 清空文件框，使同一文件可再次选择。 */
async function importBackup(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const count = await store.importBackup(file)
    window.alert(`已导入 ${count} 份简历。`)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '导入失败，请确认文件有效。')
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <main class="library-shell">
    <header class="library-header">
      <RouterLink class="brand" to="/"
        ><span class="brand-icon">R</span><span>简历工坊</span></RouterLink
      >
      <RouterLink class="back-link" to="/">返回当前简历 →</RouterLink>
    </header>

    <section class="library-content">
      <div class="library-title-row">
        <div>
          <p class="eyebrow">YOUR WORKSPACE</p>
          <h1>我的简历</h1>
          <p class="muted">为不同岗位维护独立版本，内容和样式互不影响。</p>
        </div>
        <button class="button button-primary button-large" @click="createResume">
          ＋ 新建简历
        </button>
      </div>

      <div class="backup-bar">
        <div>
          <strong>浏览器本地数据</strong><span>自动保存到当前浏览器，不会上传服务器</span>
        </div>
        <div class="backup-actions">
          <button class="button button-quiet" @click="exportBackup">备份全部简历</button>
          <button class="button button-quiet" @click="importInput?.click()">
            导入备份
          </button>
          <input
            ref="importInput"
            class="visually-hidden"
            type="file"
            accept="application/json,.json"
            @change="importBackup"
          />
        </div>
      </div>

      <div class="resume-grid">
        <article v-for="resume in resumesSorted" :key="resume.id" class="resume-card">
          <button
            class="resume-card-preview"
            :aria-label="`打开${resume.title}，${getResumeTemplate(resume.templateId).name}`"
            @click="openResume(resume.id)"
          >
            <TemplateThumbnail
              :template-id="resume.templateId"
              :accent="resume.appearance.accent"
              large
            />
            <span class="card-open">打开编辑 →</span>
          </button>
          <div class="resume-card-meta">
            <div>
              <input
                :value="resume.title"
                class="resume-title-input"
                aria-label="简历名称"
                @input="renameResume(resume.id, $event)"
              />
              <p>
                {{ getResumeTemplate(resume.templateId).name }} ·
                {{ formatDate(resume.updatedAt) }}
              </p>
            </div>
            <div class="card-menu">
              <button title="复制简历" @click="duplicateResume(resume.id)">复制</button>
              <button
                title="删除简历"
                class="danger-text"
                @click="deleteResume(resume.id)"
              >
                删除
              </button>
            </div>
          </div>
        </article>
      </div>

      <p class="library-footnote">
        简历保存在当前浏览器的本地数据库，不在项目文件夹内。换浏览器、电脑或访问地址时，请先下载备份，再在新环境导入。
      </p>
    </section>
  </main>
</template>
