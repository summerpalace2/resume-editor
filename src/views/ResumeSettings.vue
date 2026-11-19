<script setup lang="ts">
/** @file 当前简历的版式、字体与配色设置页面；使用共享画布实时预览。 */
import { computed, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { useResumeStore } from '../stores/resumes'
import GithubIcon from '../components/GithubIcon.vue'
import ResumePreviewViewport from '../components/ResumePreviewViewport.vue'
import TemplateThumbnail from '../components/TemplateThumbnail.vue'
import { paletteGroups, resumePalettes } from '../data/palettes'
import { githubStickerOptions, resolveGithubSticker } from '../data/stickers'
import {
  getResumeTemplate,
  layoutLabels,
  resumeTemplates,
  type ResumeLayout,
} from '../data/templates'
import {
  baseFontOptions,
  entryTitleFontOption,
  entryTitleFontSize,
  headerFontOptions,
  headerFontSize,
  letterSpacing,
  letterSpacingOption,
  profileLineFontSize,
  paragraphSpacing,
  paragraphSpacingOption,
} from '../data/typography'
import type {
  AccentChoice,
  FontChoice,
  GithubStickerId,
  HeaderFontTarget,
  ResumeTemplateId,
} from '../types'

const store = useResumeStore()
const router = useRouter()
const previewDialog = useTemplateRef<HTMLDialogElement>('previewDialog')
const expandedPreview = ref(false)
/** 原生对话框负责焦点约束和 Escape，关闭后仍保留小预览的查看位置。 */
function openPreview(): void {
  previewDialog.value?.showModal()
  expandedPreview.value = true
}

function closePreview(): void {
  previewDialog.value?.close()
}
/** 当前文档外观只供读取；所有修改经 store 动作校验、更新时间和保存。 */
const appearance = computed(() => store.activeResume?.appearance)
const currentParagraphSpacing = computed(() =>
  appearance.value ? paragraphSpacing(appearance.value) : paragraphSpacingOption.default,
)
const currentLetterSpacing = computed(() =>
  appearance.value ? letterSpacing(appearance.value) : letterSpacingOption.default,
)
const currentEntryTitleSize = computed(() =>
  appearance.value ? entryTitleFontSize(appearance.value) : 20,
)

/** 滑杆与数值框共用动作；空值不提交，越界输入限幅后再交给文档校验。 */
function updateParagraphSpacing(event: Event): void {
  if (!store.activeResume || !(event.target instanceof HTMLInputElement)) return
  const value = event.target.valueAsNumber
  if (!Number.isFinite(value)) {
    event.target.value = String(currentParagraphSpacing.value)
    return
  }
  const spacing = Math.min(
    paragraphSpacingOption.max,
    Math.max(paragraphSpacingOption.min, value),
  )
  event.target.value = String(spacing)
  store.updateAppearance(store.activeResume.id, {
    paragraphSpacing: spacing,
  })
}

function updateLetterSpacing(event: Event): void {
  if (!store.activeResume || !(event.target instanceof HTMLInputElement)) return
  const value = event.target.valueAsNumber
  if (!Number.isFinite(value)) {
    event.target.value = String(currentLetterSpacing.value)
    return
  }
  const tracking =
    Math.round(
      Math.min(letterSpacingOption.max, Math.max(letterSpacingOption.min, value)) * 10,
    ) / 10
  event.target.value = String(tracking)
  store.updateAppearance(store.activeResume.id, {
    letterSpacing: tracking,
  })
}
/** 当前界面与画布使用同一字号解析器，旧文档缺省值保持一致。 */
function getHeaderSize(target: HeaderFontTarget): number {
  const resume = store.activeResume
  return resume ? headerFontSize(resume.appearance, resume.templateId, target) : 18
}

/** @param index 个人信息行的零基索引，与逐行字号数组对应。 */
function getProfileSize(index: number): number {
  return appearance.value ? profileLineFontSize(appearance.value, index) : 18
}

/** @param target 独立头部字段；event 来自 range 输入，保留未修改字段的覆盖值。 */
function updateHeaderSize(target: HeaderFontTarget, event: Event): void {
  const resume = store.activeResume
  if (!resume || !(event.target instanceof HTMLInputElement)) return
  store.updateAppearance(resume.id, {
    headerFontSizes: {
      ...resume.appearance.headerFontSizes,
      [target]: Number(event.target.value),
    },
  })
}

/** 扩展逐行字号数组时先补齐其余行默认值，避免稀疏数组影响备份校验。 */
function updateProfileSize(index: number, event: Event): void {
  const resume = store.activeResume
  if (!resume || !(event.target instanceof HTMLInputElement)) return
  const sizes = Array.from(
    { length: Math.max(index + 1, resume.appearance.profileLineScales?.length ?? 0) },
    (_, i) => getProfileSize(i),
  )
  sizes[index] = Number(event.target.value)
  store.updateAppearance(resume.id, { profileLineScales: sizes })
}

/** 基础字号范围来自唯一登记表，避免界面和校验规则各自写死。 */
function updateBaseSize(
  key: (typeof baseFontOptions)[number]['key'],
  event: Event,
): void {
  if (store.activeResume && event.target instanceof HTMLInputElement)
    store.updateAppearance(store.activeResume.id, { [key]: Number(event.target.value) })
}

function updateEntryTitleSize(event: Event): void {
  if (store.activeResume && event.target instanceof HTMLInputElement)
    store.updateAppearance(store.activeResume.id, {
      entryTitleScale: Number(event.target.value),
    })
}

function resetEntryTitleSize(): void {
  if (store.activeResume)
    store.updateAppearance(store.activeResume.id, { entryTitleScale: undefined })
}

function selectFont(font: FontChoice): void {
  if (store.activeResume) store.updateAppearance(store.activeResume.id, { font })
}

const fonts: { id: FontChoice; name: string; sample: string; stack: string }[] = [
  {
    id: 'modern',
    name: '清晰现代',
    sample: 'Aa 字体预览',
    stack: '"Museo Sans", Arial, "Microsoft YaHei", sans-serif',
  },
  {
    id: 'classic',
    name: '稳重经典',
    sample: 'Aa 宋体衬线',
    stack: 'Georgia, "Songti SC", "SimSun", serif',
  },
  {
    id: 'round',
    name: '柔和圆润',
    sample: 'Aa 圆润无衬线',
    stack: '"Trebuchet MS", "Microsoft YaHei", sans-serif',
  },
  {
    id: 'heiti',
    name: '醒目黑体',
    sample: 'Aa 清晰黑体',
    stack: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "SimHei", sans-serif',
  },
  {
    id: 'kaiti',
    name: '楷体书卷',
    sample: 'Aa 楷体风格',
    stack: 'Georgia, "KaiTi", "STKaiti", "楷体", serif',
  },
  {
    id: 'fangsong',
    name: '公文仿宋',
    sample: 'Aa 仿宋典雅',
    stack: 'Georgia, "FangSong", "STFangsong", "仿宋", serif',
  },
  {
    id: 'mono',
    name: '极客等宽',
    sample: 'Aa Code 01',
    stack: '"JetBrains Mono", "Cascadia Code", Consolas, "Microsoft YaHei", monospace',
  },
]

/** 筛选只影响画廊展示，不更改当前文档版式，也不写入备份。 */
const templateFilter = ref<'all' | ResumeLayout>('all')
const templateFilters = [
  { id: 'all', label: '全部' },
  { id: 'single', label: '单栏' },
  { id: 'columns', label: '双栏' },
  { id: 'sidebar', label: '信息侧栏' },
] as const
const filteredTemplates = computed(() =>
  resumeTemplates.filter(
    (template) =>
      templateFilter.value === 'all' || template.layout === templateFilter.value,
  ),
)

/** 只更新版式 ID 和修改时间；内容、照片及显式左右栏归属继续保留。 */
function selectTemplate(id: ResumeTemplateId): void {
  if (!store.activeResume) return
  store.selectTemplate(store.activeResume.id, id)
}

/** 静态主题元信息按类别分组；颜色值不在此页面重复定义。 */
const groupedPalettes = paletteGroups.map((group) => ({
  ...group,
  palettes: resumePalettes.filter((palette) => palette.group === group.id),
}))

/** 更新当前文档配色；画布和缩略图通过登记表解析相同 ID。 */
function selectAccent(id: AccentChoice): void {
  if (!store.activeResume) return
  store.updateAppearance(store.activeResume.id, { accent: id })
}

const currentGithubSticker = computed(() => resolveGithubSticker(appearance.value))

function selectGithubSticker(id: GithubStickerId): void {
  if (!store.activeResume) return
  store.updateAppearance(store.activeResume.id, { githubSticker: id })
}
</script>

<template>
  <main v-if="store.activeResume && appearance" class="settings-shell">
    <header class="settings-header">
      <RouterLink class="brand" to="/"
        ><span class="brand-icon">R</span><span>简历工坊</span></RouterLink
      >
      <button class="back-link" @click="router.push('/')">← 返回简历预览</button>
    </header>

    <div class="settings-layout">
      <section class="settings-content">
        <p class="eyebrow">APPEARANCE</p>
        <h1>样式设置</h1>
        <p class="muted">
          调整后会立即预览，并只应用于“{{ store.activeResume.title }}”。
        </p>

        <section class="setting-card">
          <div class="setting-heading">
            <div>
              <h2>间距设置</h2>
              <p>分别调整段落间隔与全局文字间距，预览与 PDF 导出同步生效</p>
            </div>
          </div>
          <label class="range-setting">
            <span
              >正文段落 <strong>{{ currentParagraphSpacing }} px</strong></span
            >
            <span class="paragraph-spacing-controls">
              <input
                type="range"
                aria-label="正文段落间距"
                :min="paragraphSpacingOption.min"
                :max="paragraphSpacingOption.max"
                step="1"
                :value="currentParagraphSpacing"
                @input="updateParagraphSpacing"
              />
              <input
                type="number"
                aria-label="输入正文段落间距"
                :min="paragraphSpacingOption.min"
                :max="paragraphSpacingOption.max"
                step="1"
                :value="currentParagraphSpacing"
                @change="updateParagraphSpacing"
              />
            </span>
          </label>
          <label class="range-setting">
            <span
              >文字间距 <strong>{{ currentLetterSpacing }} px</strong></span
            >
            <span class="paragraph-spacing-controls">
              <input
                type="range"
                aria-label="文字间距"
                :min="letterSpacingOption.min"
                :max="letterSpacingOption.max"
                :step="letterSpacingOption.step"
                :value="currentLetterSpacing"
                @input="updateLetterSpacing"
              />
              <input
                type="number"
                aria-label="输入文字间距"
                :min="letterSpacingOption.min"
                :max="letterSpacingOption.max"
                :step="letterSpacingOption.step"
                :value="currentLetterSpacing"
                @change="updateLetterSpacing"
              />
            </span>
          </label>
        </section>

        <section class="setting-card">
          <div class="setting-heading">
            <div>
              <h2>简历布局</h2>
              <p>切换版式不会改变简历内容</p>
            </div>
            <span class="template-count">{{ resumeTemplates.length }} 种版式</span>
          </div>
          <div class="template-filters" role="group" aria-label="按布局筛选模板">
            <button
              v-for="filter in templateFilters"
              :key="filter.id"
              :aria-pressed="templateFilter === filter.id"
              @click="templateFilter = filter.id"
            >
              {{ filter.label }}
            </button>
          </div>
          <div class="template-options">
            <button
              v-for="template in filteredTemplates"
              :key="template.id"
              class="template-option"
              :class="{ selected: store.activeResume.templateId === template.id }"
              :aria-pressed="store.activeResume.templateId === template.id"
              @click="selectTemplate(template.id)"
            >
              <TemplateThumbnail :template-id="template.id" :accent="appearance.accent" />
              <span class="template-option-copy">
                <span class="template-layout-label">{{
                  layoutLabels[template.layout]
                }}</span>
                <strong>{{ template.name }}</strong>
                <small>{{ template.description }}</small>
              </span>
              <span
                v-if="store.activeResume.templateId === template.id"
                class="template-selected"
                aria-label="已选择"
                >✓</span
              >
            </button>
          </div>
        </section>

        <section class="setting-card">
          <div class="setting-heading">
            <div>
              <h2>字体大小</h2>
              <p>头部每项信息、栏目标题和正文分别调整</p>
            </div>
            <span class="setting-icon">Aa</span>
          </div>
          <label class="range-setting"
            ><span
              >姓名 <strong>{{ appearance.nameScale }} px</strong></span
            ><input
              :value="appearance.nameScale"
              aria-label="姓名字号"
              type="range"
              :min="baseFontOptions[0].min"
              :max="baseFontOptions[0].max"
              step="1"
              @input="updateBaseSize('nameScale', $event)"
          /></label>
          <label
            v-for="option in headerFontOptions"
            :key="option.key"
            class="range-setting"
          >
            <span
              >{{ option.label }}
              <strong>{{ getHeaderSize(option.key) }} px</strong></span
            >
            <input
              type="range"
              :aria-label="`${option.label}字号`"
              :min="option.min"
              :max="option.max"
              step="0.5"
              :value="getHeaderSize(option.key)"
              @input="updateHeaderSize(option.key, $event)"
            />
          </label>
          <label
            v-for="(line, index) in store.activeResume.profile.profileLines ?? []"
            :key="index"
            class="range-setting"
          >
            <span
              >个人信息 {{ index + 1 }}
              <strong>{{ getProfileSize(index) }} px</strong></span
            >
            <small class="font-setting-example">{{ line || '未填写' }}</small>
            <input
              type="range"
              :aria-label="`个人信息 ${index + 1} 字号`"
              min="12"
              max="28"
              step="0.5"
              :value="getProfileSize(index)"
              @input="updateProfileSize(index, $event)"
            />
          </label>
          <label class="range-setting"
            ><span
              >栏目标题 <strong>{{ appearance.headingScale }} px</strong></span
            ><input
              :value="appearance.headingScale"
              aria-label="栏目标题字号"
              type="range"
              :min="baseFontOptions[1].min"
              :max="baseFontOptions[1].max"
              step="1"
              @input="updateBaseSize('headingScale', $event)"
          /></label>
          <label class="range-setting"
            ><span
              >条目标题
              <span class="range-setting-meta"
                ><button
                  v-if="appearance.entryTitleScale !== undefined"
                  type="button"
                  class="range-reset-link"
                  @click.prevent="resetEntryTitleSize"
                >
                  跟随正文</button
                ><strong>{{ currentEntryTitleSize }} px</strong></span
              ></span
            ><input
              :value="currentEntryTitleSize"
              aria-label="条目标题字号"
              type="range"
              :min="entryTitleFontOption.min"
              :max="entryTitleFontOption.max"
              :step="entryTitleFontOption.step"
              @input="updateEntryTitleSize"
          /></label>
          <label class="range-setting"
            ><span
              >正文 <strong>{{ appearance.bodyScale }} px</strong></span
            ><input
              :value="appearance.bodyScale"
              aria-label="正文字号"
              type="range"
              :min="baseFontOptions[2].min"
              :max="baseFontOptions[2].max"
              step="1"
              @input="updateBaseSize('bodyScale', $event)"
          /></label>
        </section>

        <section class="setting-card">
          <div class="setting-heading">
            <div>
              <h2>字体风格</h2>
              <p>选择一组适合简历的字体</p>
            </div>
          </div>
          <div class="font-options">
            <button
              v-for="font in fonts"
              :key="font.id"
              class="font-option"
              :class="{ selected: appearance.font === font.id }"
              :aria-pressed="appearance.font === font.id"
              @click="selectFont(font.id)"
            >
              <span :style="{ fontFamily: font.stack }">{{ font.sample }}</span
              ><small>{{ font.name }}</small>
            </button>
          </div>
        </section>

        <section class="setting-card">
          <div class="setting-heading">
            <div>
              <h2>GitHub 贴纸样式</h2>
              <p>选择主页链接旁展示的矢量贴纸图标，编辑态点击图标也可快速切换</p>
            </div>
            <span class="template-count">{{ githubStickerOptions.length }} 款贴纸</span>
          </div>
          <div class="sticker-options" role="group" aria-label="GitHub 贴纸样式">
            <button
              v-for="sticker in githubStickerOptions"
              :key="sticker.id"
              class="sticker-option"
              :class="{ selected: currentGithubSticker === sticker.id }"
              :aria-pressed="currentGithubSticker === sticker.id"
              @click="selectGithubSticker(sticker.id)"
            >
              <span class="sticker-option-preview">
                <GithubIcon :variant="sticker.id" />
              </span>
              <strong>{{ sticker.name }}</strong>
              <small>{{ sticker.description }}</small>
            </button>
          </div>
        </section>

        <section class="setting-card">
          <div class="setting-heading">
            <div>
              <h2>主题颜色</h2>
              <p>页眉、栏目浅底和分隔线整套搭配，立即应用到当前版式</p>
            </div>
            <span class="template-count">{{ resumePalettes.length }} 套配色</span>
          </div>
          <section v-for="group in groupedPalettes" :key="group.id" class="palette-group">
            <h3>{{ group.name }}</h3>
            <div class="color-options" role="group" :aria-label="group.name">
              <button
                v-for="palette in group.palettes"
                :key="palette.id"
                class="color-option"
                :class="{ selected: appearance.accent === palette.id }"
                :aria-pressed="appearance.accent === palette.id"
                :aria-label="palette.name"
                @click="selectAccent(palette.id)"
              >
                <span class="palette-swatches" aria-hidden="true">
                  <i :style="{ backgroundColor: palette.header, color: palette.onHeader }"
                    >Aa</i
                  >
                  <i :style="{ backgroundColor: palette.soft }"></i>
                  <i :style="{ backgroundColor: palette.strong }"></i>
                  <i :style="{ backgroundColor: palette.line }"></i>
                </span>
                <strong>{{ palette.name }}</strong>
                <b v-if="appearance.accent === palette.id" aria-hidden="true">✓</b>
              </button>
            </div>
          </section>
        </section>
      </section>

      <aside class="settings-preview-wrap">
        <div class="preview-label">
          <span>实时预览</span>
          <span>A4 · {{ getResumeTemplate(store.activeResume.templateId).name }}</span>
        </div>
        <ResumePreviewViewport :resume="store.activeResume">
          <template #actions>
            <button type="button" class="preview-expand" @click="openPreview">
              ⛶ 展开预览
            </button>
          </template>
        </ResumePreviewViewport>
        <p class="preview-note">样式调整会自动保存到当前简历。</p>
      </aside>
    </div>
    <dialog
      ref="previewDialog"
      class="preview-dialog no-print"
      aria-labelledby="expanded-preview-title"
      @close="expandedPreview = false"
    >
      <header class="preview-dialog-header">
        <div>
          <h2 id="expanded-preview-title">简历大预览</h2>
          <span>A4 · {{ getResumeTemplate(store.activeResume.templateId).name }}</span>
        </div>
        <button type="button" class="button button-quiet" @click="closePreview">
          收起预览 · Esc
        </button>
      </header>
      <ResumePreviewViewport v-if="expandedPreview" :resume="store.activeResume" large />
    </dialog>
  </main>
</template>
