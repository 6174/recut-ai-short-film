# src/

> L2 | 父级: /apps/vox-broll/ui/README.md

成员清单
main.tsx: AI 短片工作台编排层；以两列等宽面板按立项、资料研究、创作方案、剧本与场景方案、视觉设定与媒体生产展示阶段；仅在宿主通信就绪后读取资源，资料确认与方案选定由用户在详情中显式触发；起始表单只构建并回填中文任务书，绝不提交 Agent 对话；资源事件后刷新并按资源 ID 同步已打开详情。
use-media-asset-events.tsx: iframe 内 Recut 素材 SSE 缓存边界；首次快照和增量事件维护唯一生命周期真相，资源卡、详情与引用缩略图以 SSE 为主；仅对仍在生成的本地素材每两秒校验一次，覆盖 SSE 重连窗口，不查询 Provider。
stage-panel.tsx: 工作台单层创作分区；以统一边框卡片承载标题、资源画布、空状态和创建入口，避免与页面标题重复绘制顶部分隔线。
resource-card.tsx: 固定宽度的只读素材缩略图；视觉设定和关键画面展示实际生成图，完成的场景视频与成片交付通过 iframe 展示静音循环视频，运行或失败素材显示状态兜底；资源不提供删除或移出入口。
resource-dialogs.tsx: iframe 内受控资源详情模态框、资料确认/方案选定显式入口与新建请求弹窗；立项收集选题、风格模板、画幅、细节和时长，构建并复制中文任务书后回填宿主 Agent 输入框但绝不提交；各阶段只收集本阶段意图，不让用户选择前序资源。
context-mentions.tsx: 创作要求的通用 @ 上下文输入；从当前项目条目或宿主统一系统素材选择器临时添加 token，只随本次 Agent 任务书传递，不保存为资源关系。
resource-view.tsx: 资源展示语义层；按阶段把立项、资料研究、方案、剧本、导演风格和媒体 JSON 翻译为图文、缩略文本、iframe 视频预览、按需播放器与清单；优先读取独立场景视频的 `video.assetId` 与成片交付的最终 `assetId`，兼容历史 `scenes[]/shots[]`；所有真实媒体从共享素材 SSE 缓存读取状态，生成中显示实时计时，终态仅展示后端 `generationDurationMs`。
style-references.tsx: 风格模板展示数据与本地参考图预览；读取 Skill 同级 `references/images/` 在构建时复制的静态图片，缺图时显示可操作占位，不建立项目资源依赖。
video-frame.tsx: 视频预览原子；缩略图将静音循环 `<video>` 写入 `srcDoc` iframe，详情以 iframe 加载原始媒体 URL，避免裸视频元素占用父级交互和渲染状态。
timeline-export.tsx: 成片交付专用的两轨确定性时间线；选择已有场景视频与声音设计，按顺序排列、浏览器预览并以尺寸/帧率/画质设置调用 `delivery.export` 生成新的视频素材；片段 ID 不依赖安全上下文 UUID，错误时只将环境诊断交给 Codex。
recut-sdk.ts: iframe 与宿主的 MessageChannel 边界；在 10 秒内向父页面重试声明就绪并等待连接，再发送请求；请求 ID 不依赖安全上下文 UUID，记录连接、请求、回包或错误并发布项目事件。
ui.tsx: 基于 Tailwind、Radix Dialog / Dropdown Menu 的 shadcn 风格 UI 原子。
style.css: Tailwind v4 入口与 AI 短片创作台设计令牌；与宿主共享深色画布、浅色文字和明亮品牌绿主题。

职责关系
`main.tsx` 聚合资源状态；卡片和弹窗只接收数据与回调；`style-references.tsx` 只展示随构建复制的内置风格封面；`context-mentions.tsx` 只形成单次 Agent 上下文；`ui.tsx` 不了解资源业务。各创作分区不维护资源依赖，唯一顺序来自 `workflow.context`，复杂关联由 Agent 基于其 `inputs` 和临时 @ 上下文推理。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
