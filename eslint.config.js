/** @file Vue/TypeScript 静态规则；格式规则由 Prettier 负责。 */
import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['src/**/*.{ts,vue}', 'vite.config.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...vue.configs['flat/recommended'],
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { parser: tseslint.parser },
    },
    rules: { 'vue/multi-word-component-names': ['error', { ignores: ['App'] }] },
  },
  {
    files: ['*.js', 'scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      // 核心文档操作禁止新增界面与存储依赖，避免拆分后重新耦合。
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'vue',
            'pinia',
            'vue-router',
            '**/stores/*',
            '**/storage/*',
            '**/services/*',
            '**/composables/*',
          ],
        },
      ],
    },
  },
  prettier,
)
