# 文件、关键函数与参数阅读指南

源码中文注释解释局部规则，本文提供修复后的全局阅读路径。架构历史发现与当前状态见 [架构评审](architecture-review.md)。

## 1. 阅读顺序

1. `src/types.ts` → `src/domain/validation.ts`：编译时契约与运行时边界。
2. `src/domain/factories.ts` → `src/data/defaultResume.ts`：空栏目、空文档、示例及副本。
3. `src/App.vue` → `src/stores/resumes.ts` → `src/storage/saveQueue.ts` → `src/storage/database.ts`：读取权限、修改动作、保存与恢复。
4. `src/templates/ResumeCanvas.vue` → `templates/components` → `src/composables/useResumeEditing.ts` → `src/domain/operations.ts`：展示到文档变换。
5. `src/data/templates.ts`、`palettes.ts`、`typography.ts` → `src/composables/useResumeStyle.ts`：版式、配色、字号及侧栏测量。
6. `src/storage/backup.ts` 和 `src/templates/resume-print.css`：JSON 备份与 PDF 导出。

## 2. 文件地图

| 文件/目录                                    | 职责                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `index.html`                                 | 浏览器入口，提供 #app 挂载点                                          |
| `src/main.ts`                                | 注册 Pinia/Router；基础、变体、打印 CSS 按顺序加载                    |
| `src/App.vue`                                | 唯一初始化入口，显示读取/保存/冲突恢复界面，监听后台和退出            |
| `src/router.ts`                              | 三个页面路由，离开页面前提交草稿并等待 flush；静态托管需 History 回退 |
| `src/env.d.ts`                               | Vite 编译时环境类型，无运行时行为                                     |
| `src/types.ts`                               | 文档、个人信息、栏目、条目、外观、备份的类型契约                      |
| `src/domain/validation.ts`                   | 重建完整已校验文档；外部 JSON 和数据库记录共用；剔除未知字段          |
| `src/domain/factories.ts`                    | 空条目/栏目工厂及稳定 ID，不依赖 Vue 或页面                           |
| `src/domain/operations.ts`                   | 草稿的字段变换、栏内排序、跨栏移动；不操作父状态或存储                |
| `src/domain/links.ts`                        | HTTP(S) 地址规范化、GitHub 显示标签和编辑值                           |
| `src/data/defaultResume.ts`                  | 空简历、首次示例及整份文档复制；不访问存储                            |
| `src/data/clone.ts`                          | toRaw + structuredClone；只解除根代理，输入须可序列化                 |
| `src/data/templates.ts`                      | 八种版式与结构分类，缺省栏目归属                                      |
| `src/data/palettes.ts`                       | 十六套语义颜色与唯一主题校验                                          |
| `src/data/typography.ts`                     | 基础/头部字号范围、缺省值与可选覆盖解析                               |
| `src/stores/resumes.ts`                      | 文档集合、活动 ID、统一修改动作、读取与保存状态                       |
| `src/storage/database.ts`                    | IndexedDB 原子读取/写入，事务内比较 workspaceRevision                 |
| `src/storage/saveQueue.ts`                   | 独立的串行防抖调度与修改序号，不依赖 Vue/DOM                          |
| `src/storage/backup.ts`                      | v1 协议、JSON 文件读取/下载，文档校验交给 domain                      |
| `src/services/photos.ts`                     | 浏览器图片解码、640px 缩放与 JPEG 编码，释放临时 URL                  |
| `src/services/editLifecycle.ts`              | 离开前提交活动编辑框的事件协议                                        |
| `src/composables/useResumeEditing.ts`        | 克隆草稿、调用文档操作、发事件；确认框、拖拽事件、照片任务生命周期    |
| `src/composables/useResumeStyle.ts`          | 文档到 CSS 变量；字体就绪后重新测量侧栏                               |
| `src/components/InlineEdit.vue`              | 局部草稿、提交/取消，响应页面提交协议                                 |
| `src/components/ResumePreview.vue`           | 公共预览入口，转发 props/emit                                         |
| `src/components/TemplateThumbnail.vue`       | 共用配色的结构示意缩略图，非正文截图                                  |
| `src/templates/ResumeCanvas.vue`             | 画布容器、列分组与添加栏目；不访问 store/数据库                       |
| `src/templates/components/ResumeHeader.vue`  | 个人信息、链接、照片的展示与输入                                      |
| `src/templates/components/ResumeSection.vue` | 栏目标题、栏目控件与条目集合                                          |
| `src/templates/components/ResumeEntry.vue`   | 单条经历、项目链接、字段输入与条目控件                                |
| `src/views/ResumeWorkspace.vue`              | 编辑开关、状态提示、提交文档副本及浏览器打印                          |
| `src/views/ResumeLibrary.vue`                | 多文档管理、时间排序、改名、备份导入导出                              |
| `src/views/ResumeSettings.vue`               | 版式、字体、字号、配色；全部经 store 动作修改                         |
| `src/styles.css`                             | 应用和画布基础样式，屏幕响应式及恢复提示                              |
| `src/templates/resume-variants.css`          | 八种版式的布局差异                                                    |
| `src/templates/resume-print.css`             | A4 覆盖、自然分页、续页背景，必须最后加载                             |
| `vite.config.ts`                             | Vue 编译插件与开发/构建配置                                           |
| `tsconfig.json`                              | strict、未使用检查、DOM 类型；noEmit，打包由 Vite 完成                |
| `package.json` / `package-lock.json`         | 命令与依赖；锁文件由 npm 维护，JSON 不添加注释                        |
| `eslint.config.js`                           | Vue/TypeScript 推荐规则，domain 依赖边界；Prettier 负责格式           |
| `.prettierignore` / `.gitignore`             | 排除生成物及锁文件格式处理，不提供数据保存能力                        |
| `.github/workflows/check.yml`                | Node 24 下运行 npm ci 与 check，未执行云端检查                        |
| `docs/fixtures/*.json`                       | 三组固定 PDF 样本，每组覆盖八种版式，均为虚构信息                     |
| `AGENTS.md` / `README.md`                    | 模块约束和使用方法                                                    |

## 3. 关键数据参数

| 参数                                       | 含义与边界                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| 文档/栏目/条目的 `id`                      | 稳定定位标识，分别在工作区/文档/栏目作用域唯一；索引用于排序，不可互换 |
| `title`                                    | 管理页名称，与 profile.name 分开                                       |
| `templateId` / `appearance.accent`         | 持久化版式/主题 ID，从集中登记表解析                                   |
| `sections` / `entries`                     | 原始顺序；隐藏仍保留数据与索引                                         |
| `kind` / `column` / `visible`              | 栏目类别、可选左右归属、展示开关；单栏保留左右归属                     |
| `description` / `period`                   | 正文纯文本和换行，符号由用户输入；时间直接展示，不解析                 |
| `link` / `github`                          | 保存输入文本，跳转时规范化 HTTP(S)；项目链接编辑器位于项目栏目         |
| `profileLines` / `profileLineScales`       | 按索引配对，缺字号使用 18px，范围 12～28px                             |
| `photo`                                    | 本地光栅图片 data URL 或 null；写入和备份均包含照片                    |
| `summary`                                  | 旧数据保留字段，画布未单独展示                                         |
| `nameScale` / `headingScale` / `bodyScale` | 逻辑画布 px 字号，Scale 不是倍率；范围 40～60 / 20～32 / 14～24        |
| `headerFontSizes`                          | 可选单项字号，缺项按版式回退，不强行把默认值写入旧备份                 |
| `updatedAt`                                | Unix 毫秒时间戳；统一修改动作刷新，管理页日期与排序使用它              |
| `ready` / `canPersist`                     | 完成读取尝试 / 获得写回权限；读取失败时前者 true、后者 false           |
| `conflict`                                 | 本地修订已由另一页面推进；禁止写回，保留内存供备份                     |
| `databaseRevision`                         | 成功读取/提交取得的数据库修订号，不能按更新时间推测                    |
| 队列 `dirty` / `committed`                 | 内存修改序号，区别于数据库修订；旧完成回调不提交更新的修改             |
| `hasUnsavedChanges`                        | 最后已知修改尚未提交，用于保存提示和浏览器离开确认                     |

## 4. 关键函数

| 函数                                                         | 边界                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| `parseResumeDocument` / `parseWorkspaceDocuments`            | 校验全层级及范围；已知旧可选字段兼容，其余无效数据抛出带位置的错误    |
| `createResume` / `createStarterResume` / `cloneResume`       | 空文档、首次示例、整份副本；仅成功读取空库时生成首次示例              |
| store `initialize`                                           | 合并并发读取；重读可能放弃内存修改，恢复界面先提供备份与确认          |
| store `replaceResume`                                        | 校验、刷新时间、替换已存在 ID，再安排保存；冲突时仅接受恢复用内存草稿 |
| store `renameResume` / `updateAppearance` / `selectTemplate` | 所有页面共享规则，不直接 v-model 文档字段                             |
| `loadWorkspace`                                              | 事务完成且文档校验成功后返回，连接在 finally 关闭                     |
| `saveWorkspace`                                              | 接收全量快照和 expectedRevision；事务内先比较修订，再原子 clear/put   |
| 队列 `markDirty` / `flush` / `reset`                         | 防抖 / 可等待排空 / 成功重读后重置；保存失败保留未提交序号            |
| store `importBackup`                                         | 整份文件先校验后合并，冲突文档 ID 重生成；不覆盖原集合                |
| `useResumeEditing.apply`                                     | 克隆当前文档，操作返回 true 才提交副本，不直接改变 props              |
| `moveSection` / `moveSectionTo` / `moveSectionToColumn`      | 栏内偏移 / 原始索引拖拽 / 移到指定栏末尾，先固定默认分组              |
| `moveEntryTo`                                                | 仅所属栏目的条目排序，拒绝无效源/目标索引                             |
| `useResumeStyle`                                             | 按字体和实际文字测量侧栏，字体就绪后刷新；不是存储规则                |
| `compressPhoto` / `selectPhoto`                              | 压缩只返回数据地址；编排丢弃换文档、取消或新请求后的旧结果            |
| `commitActiveEdits`                                          | 提交活动 URL 输入和局部草稿，避免导航卸载前丢失未提交字段             |
| `exportPdf`                                                  | 提交草稿、请求保存、等待字体和图片，再打开浏览器打印，不直接生成 Blob |

## 5. 容易误读的常量

| 数值                                  | 用途                                                               |
| ------------------------------------- | ------------------------------------------------------------------ |
| IndexedDB `resume-studio` / version 1 | 保持已有数据库位置和仓库结构；修订存入已有 settings，旧库缺省 0    |
| 备份 `format` / version 1             | 外部文件协议，与数据库结构版本和提交修订不同                       |
| 自动保存 350ms                        | 连续输入的等待窗口，不表示数据已经提交                             |
| 默认 50 / 24 / 20px                   | 姓名 / 栏目 / 正文逻辑字号                                         |
| 侧栏 300～512px                       | 动态测量下限与上限，最多占逻辑画布一半                             |
| 侧栏补偿 44 / 50 / 51px               | 内边距 / 内边距加 GitHub 间距 / 内边距加联系方式间距，另计图标字号 |
| 照片 640px / JPEG 0.86                | 最长边与编码质量，不是显示尺寸或透明度                             |
| 1024 × 1448px                         | A4 比例基线；内容超过最低高度可自然分页                            |
| 预览 0.29296875                       | 300 / 1024，整体缩小，保留真实换行                                 |
| 打印 0.775                            | 约为 A4 CSS 宽度 / 1024；pt ≈ 逻辑 px × 0.775 × 72/96              |
| orphans/widows 3                      | 控制段落分页最少行数，不保证任意内容一页展示                       |

## 6. 扩展约定

- 文档新字段同步修改类型、默认值、完整校验和旧备份兼容。
- 新版式/主题集中登记，不复制校验列表；保持原有 ID。
- 新编辑动作放入 domain，组件只编排草稿和事件，页面通过 store 修改工作区。
- 修改组件 DOM 或打印规则后，按 [PDF 检查约定](pdf-checklist.md) 覆盖固定样本。
- `npm run check` 提供静态检查与构建；不能代替存储故障、交互或 PDF 运行时回归。

“浏览器本地保存”指数据留在本机浏览器数据库。网页仍需要开发服务器或构建后的静态资源。
