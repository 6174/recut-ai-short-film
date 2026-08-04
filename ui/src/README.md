# src/

> L2 | 父级: /apps/vox-broll/ui/README.md

成员清单
main.tsx: B-roll 工作台编排层；以两列等宽 panel 网格同时展示七个阶段；每次打开无资源项目时打开起始表单，表单只构建 5 秒节拍 Prompt、复制到剪贴板并回填宿主右侧 Agent 输入框，绝不保存 Brief 或提交 Agent turn；资源事件后刷新并按资源 ID 同步已打开详情，避免 resource.update 后弹窗继续显示旧快照。
use-media-asset-events.tsx: iframe 内 Recut Asset SSE 缓存边界；首次快照和增量事件维护唯一生命周期真相，资源卡、详情与引用缩略图以 SSE 为主；仅对仍在生成的本地 Asset 每两秒校验一次，覆盖 SSE 重连窗口，不查询 Provider。
stage-panel.tsx: 工作台单层创作分区；以统一边框卡片承载标题、资源画布、空状态和创建入口，避免与页面标题重复绘制顶部分隔线。
resource-card.tsx: 固定宽度的素材缩略图；Look 和 Keyframes 展示实际生成图，完成的 Scene 与 Delivery 通过 iframe 展示静音循环视频，运行或失败素材显示状态兜底，悬停显示三点操作菜单。
resource-dialogs.tsx: iframe 内受控资源详情模态框、受确认的删除入口与新建请求弹窗；Brief 弹窗固定收集选题方向、细节描述和可选/自定义时长，构建并复制 Prompt 后回填宿主 Agent 输入框但绝不提交；Look 弹窗强调参考图必须覆盖全片视觉元素；引用资源展示实际图片、iframe 视频画面或文字摘要。
resource-view.tsx: 资源展示语义层；按阶段把内部 JSON 翻译为图文、缩略文本、iframe 视频预览、按需播放器、镜头卡与清单，Brief 同时展示细节描述与预期时长；优先读取独立 Scene 的 `video.assetId` 与 Delivery 的最终 `assetId`，兼容历史 `scenes[]/shots[]` 项内的 `video.assetId` 或 `videoAssetId`；所有真实媒体从共享 Asset SSE 缓存读取状态，任何生成中的图片、音频或视频都显示实时计时，终态仅展示后端 `generationDurationMs`，历史素材绝不根据时间戳猜测生成耗时，也不直接向用户展示 JSON。
video-frame.tsx: 视频预览原子；缩略图将静音循环 `<video>` 写入 `srcDoc` iframe，详情以 iframe 加载原始媒体 URL，避免裸视频元素占用父级交互和渲染状态。
timeline-export.tsx: Delivery 专用的两轨确定性时间线；选择已有 Scene 视频与 Audio 声音，按顺序排列、浏览器预览并以尺寸/帧率/画质设置调用 `delivery.export` 生成新的视频 Asset；片段 ID 不依赖安全上下文 UUID，错误时只将环境诊断交给 Codex。
recut-sdk.ts: iframe 与宿主的 MessageChannel 边界；请求 ID 不依赖安全上下文 UUID，记录连接、请求、回包或错误并发布项目事件。
ui.tsx: 基于 Tailwind、Radix Dialog / Dropdown Menu 的 shadcn 风格 UI 原子。
style.css: Tailwind v4 入口与 Vox B-roll 设计令牌；与宿主共享白底、黑字、明亮品牌绿主题。

依赖关系
`main.tsx` 聚合资源状态；卡片和弹窗只接收数据与回调；`ui.tsx` 不了解资源业务。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
