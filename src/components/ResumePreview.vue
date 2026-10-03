<script setup lang="ts">
/**
 * @file 预览公共入口：转发文档、编辑开关及修改事件，隔离页面对具体画布的依赖。
 * 八种版式复用 ResumeCanvas，页眉、栏目和条目分别维护。
 */
import ResumeCanvas from '../templates/ResumeCanvas.vue'
import type { ResumeDocument } from '../types'

defineProps<{
  /** 当前完整文档；模板按需克隆修改并通过 update:resume 交回页面。 */
  resume: ResumeDocument
  /** 控制编辑入口显示，观察模式中的链接保持可跳转。 */
  editing: boolean
}>()

const emit = defineEmits<{
  'update:resume': [resume: ResumeDocument]
}>()
</script>

<template>
  <ResumeCanvas
    :resume="resume"
    :editing="editing"
    @update:resume="emit('update:resume', $event)"
  />
</template>
