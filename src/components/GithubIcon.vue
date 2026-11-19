<script setup lang="ts">
/** @file 渲染可切换风格的 GitHub 贴纸矢量图标；随页眉配色与字号自适应。 */
import type { GithubStickerId } from '../types'

withDefaults(defineProps<{ variant?: GithubStickerId }>(), {
  variant: 'github',
})
</script>

<template>
  <svg
    v-if="variant === 'github'"
    class="github-icon"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"
    />
  </svg>
  <svg
    v-else-if="variant === 'github-badge'"
    class="github-icon"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="10" cy="10" r="8.8" stroke="currentColor" stroke-width="1.6" />
    <path
      fill="currentColor"
      d="M10 4.2a5.8 5.8 0 0 0-1.83 11.3c.29.05.4-.13.4-.28v-1.08c-1.46.32-1.77-.62-1.77-.62-.24-.6-.58-.76-.58-.76-.48-.32.04-.32.04-.32.53.04.8.54.8.54.47.8 1.23.57 1.53.44.05-.34.18-.57.33-.7-1.17-.13-2.4-.58-2.4-2.6 0-.57.2-1.04.54-1.41-.05-.13-.24-.67.05-1.4 0 0 .44-.14 1.45.54a5 5 0 0 1 2.64 0c1-.68 1.45-.54 1.45-.54.29.73.1 1.27.05 1.4.34.37.54.84.54 1.41 0 2.02-1.23 2.47-2.4 2.6.19.16.36.48.36.97v1.44c0 .15.1.33.4.27A5.8 5.8 0 0 0 10 4.2"
    />
  </svg>
  <svg
    v-else-if="variant === 'code'"
    class="github-icon"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M7 6 3 10l4 4M13 6l4 4-4 4M11.5 4.5l-3 11" />
  </svg>
  <svg
    v-else-if="variant === 'terminal'"
    class="github-icon"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="2.2" y="3.5" width="15.6" height="13" rx="2.8" />
    <path d="m6 8 3 2.5L6 13M10.5 13H14" />
  </svg>
  <svg
    v-else-if="variant === 'spark'"
    class="github-icon"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      d="M10 1.6 12.1 7l5.5 2.1-5.5 2.1L10 16.6l-2.1-5.4L2.4 9.1 7.9 7 10 1.6Zm5.5 11.4.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z"
    />
  </svg>
  <svg
    v-else-if="variant === 'rocket'"
    class="github-icon"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path
      d="M12.5 3.2c2.3-.3 4 .1 4.3.4.3.3.7 2 .4 4.3-.4 2.8-2 5-4.3 6.8l-3.4-.9-3.3-3.3-.9-3.4c1.8-2.3 4-3.9 7.2-3.9Z"
    />
    <circle cx="12.2" cy="7.8" r="1.4" fill="currentColor" stroke="none" />
    <path d="M6.2 10.6 3.5 11.3l-.7 3.1 2.8-.6M9.4 13.8l-.7 2.7-3.1.7.6-2.8" />
  </svg>
  <svg
    v-else-if="variant === 'globe'"
    class="github-icon"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="10" cy="10" r="7.5" />
    <ellipse cx="10" cy="10" rx="3.4" ry="7.5" />
    <path d="M2.8 10h14.4M3.8 6.5h12.4M3.8 13.5h12.4" />
  </svg>
  <svg v-else class="github-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="7.2" stroke="currentColor" stroke-width="1.8" />
    <circle cx="10" cy="10" r="3.4" fill="currentColor" />
  </svg>
</template>
