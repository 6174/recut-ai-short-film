# ui/

> L2 | 父级: /apps/vox-broll/README.md

成员清单
package.json: Vite、React、Tailwind、Radix Dialog / Dropdown Menu 与 shadcn 风格组件的独立构建配置。
vite.config.ts: Vite 构建配置；只将同级 Skill 的 `references/images` 图片槽位复制到创作台，工作台版本由宿主 Header 统一展示，UI 包不重复注入版本号。
src/: 资源浏览、预览、风格参考图与新建弹窗的 React 源码；成员细节见 `src/README.md`。
index.html: Vite 的 React 挂载入口。
dist/: 由构建命令生成、由 manifest 提供给宿主的静态资源。

依赖关系
`main.tsx` 经 `recut-sdk.ts` 查询 App API，并消费父宿主从项目事件总线转发的能力完成事件；卡片与弹窗都不直接访问服务端。

设计规范
`src/style.css` 与 Recut 主工作台共享亮色画布、品牌绿主操作、低圆角和语义 token；资源卡片可用圆角容器，工具页面分区不嵌套浮层卡片。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
