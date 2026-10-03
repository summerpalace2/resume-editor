<script setup lang="ts">
/** @file 个人信息页眉的展示与就地编辑；沿用共享 CSS 的原有 DOM 结构。 */
import InlineEdit from '../../components/InlineEdit.vue'
import { useResumeEditing } from '../../composables/useResumeEditing'
import { profileLineFontSize } from '../../data/typography'
import { githubUrl, githubLabel, githubEditValue } from '../../domain/links'
import type { ResumeDocument } from '../../types'
const props = defineProps<{ resume: ResumeDocument; editing: boolean }>()
const emit = defineEmits<{ 'update:resume': [resume: ResumeDocument] }>()
const {
  updateProfile,
  updateProfileLine,
  updateGitHubFromInput,
  selectPhoto,
  removePhoto,
} = useResumeEditing(
  () => props.resume,
  (resume) => emit('update:resume', resume),
)
</script>

<template>
  <header class="resume-masthead">
    <div class="masthead-top">
      <div class="masthead-identity">
        <InlineEdit
          class="resume-name"
          :model-value="resume.profile.name"
          :editing="editing"
          placeholder="填写姓名"
          @update:model-value="updateProfile('name', $event)"
        />
        <a
          v-if="!editing && githubUrl(resume.profile.github)"
          class="github-handle"
          :href="githubUrl(resume.profile.github)"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span aria-hidden="true">◉</span>
          {{ githubLabel(resume.profile.github) }}
        </a>
        <label v-else-if="editing" class="github-handle github-handle--editing">
          <span aria-hidden="true">◉</span>
          <input
            class="link-address-input"
            type="url"
            :value="githubEditValue(resume.profile.github)"
            placeholder="GitHub 链接"
            aria-label="GitHub 链接地址"
            @change="updateGitHubFromInput"
          />
        </label>
      </div>
      <div class="resume-role">
        <InlineEdit
          :model-value="resume.profile.role"
          :editing="editing"
          placeholder="填写求职意向"
          @update:model-value="updateProfile('role', $event)"
        />
      </div>
    </div>

    <div class="masthead-bottom">
      <div class="profile-lines">
        <InlineEdit
          v-for="(line, index) in resume.profile.profileLines ?? []"
          :key="index"
          class="profile-line"
          :style="{ fontSize: `${profileLineFontSize(resume.appearance, index)}px` }"
          :model-value="line"
          :editing="editing"
          placeholder="添加个人信息"
          @update:model-value="updateProfileLine(index, $event)"
        />
        <button
          v-if="editing"
          class="masthead-add no-print"
          @click="updateProfileLine(resume.profile.profileLines?.length ?? 0, '')"
        >
          ＋ 添加信息
        </button>
      </div>

      <div class="masthead-contacts">
        <div
          v-if="resume.profile.email || editing"
          class="masthead-contact masthead-contact-email"
        >
          <InlineEdit
            :model-value="resume.profile.email"
            :editing="editing"
            placeholder="添加邮箱"
            @update:model-value="updateProfile('email', $event)"
          />
          <span aria-hidden="true">✉</span>
        </div>
        <div
          v-if="resume.profile.phone || editing"
          class="masthead-contact masthead-contact-phone"
        >
          <InlineEdit
            :model-value="resume.profile.phone"
            :editing="editing"
            placeholder="添加电话"
            @update:model-value="updateProfile('phone', $event)"
          />
          <span aria-hidden="true">☎</span>
        </div>
        <div
          v-if="resume.profile.location || editing"
          class="masthead-contact masthead-contact-location"
        >
          <InlineEdit
            :model-value="resume.profile.location"
            :editing="editing"
            placeholder="添加城市"
            @update:model-value="updateProfile('location', $event)"
          />
          <span aria-hidden="true">⌖</span>
        </div>
      </div>
    </div>

    <div v-if="resume.profile.photo" class="masthead-photo">
      <img class="portrait" :src="resume.profile.photo" alt="个人照片" />
    </div>
    <label v-if="editing" class="photo-action no-print">
      <input type="file" accept="image/*" @change="selectPhoto" />
      {{ resume.profile.photo ? '更换照片' : '添加照片' }}
    </label>
    <button
      v-if="editing && resume.profile.photo"
      class="photo-remove no-print"
      type="button"
      @click="removePhoto"
    >
      移除
    </button>
  </header>
</template>
