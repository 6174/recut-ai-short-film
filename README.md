# Vox B-roll

把一个主题做成可审阅、可继续制作的 Vox 风格 B-roll 解说片：清楚的观点、纸质拼贴视觉、真实旁白、逐段场景和最终交付都保留在同一个 Recut 项目中。

## 在 Recut 中使用

1. 打开 [recut.video](https://recut.video)，按页面提示安装本地 Recut service。
2. 在 **Apps** tab 粘贴以下 HTTPS 地址并安装：

   ```text
   https://github.com/6174/recut-vox-broll
   ```

3. 切到 **Project** tab，新建项目时选择 **Vox B-roll Explainer**。
4. 新建 Codex 或 Claude Code 对话后，点击“从一个主题开始”“把想法变成论点”或“继续当前创作”引导卡；提示词会写入输入框，仍可编辑后发送。

App 会按以下顺序引导创作，不会把未确认的想法误当成成片：

```text
Brief → Beats → Look → Keyframes → Audio → Scenes → Delivery
```

- **Brief**：收敛目标观众、核心观点与叙事张力。
- **Beats**：将观点拆成能看完的节拍。
- **Look / Keyframes**：确定并生成统一的纸质拼贴视觉。关键画面先读取当前平台图片生成方案：可使用 Media Platform 的 `recut.image.generate`，也可使用宿主配置的 Codex 原生图片生成；无论哪种方式，进入资源前都必须成为 Recut Media Asset。Codex 原生图会先写入当前 Recut 项目，再通过 `recut.media.import_image` 归档并取得真实 `assetId`，不能只作为对话预览进入 Look/Keyframe。
- **Audio / Scenes**：先生成真实旁白，再逐段生成可预览的视频。
- **Delivery**：在界面中排列已确认的视频和可选音频轨道，导出最终视频；视频原声会保留，额外音频与之混合。

视频生成昂贵：默认只生成当前下一段 Scene。确认它符合预期后，再继续下一段；要批量生成时，请明确告诉 Agent。

## 项目结构

```text
manifest.json   App 身份、作者 6174、GitHub 地址、onboarding 引导、权限、UI 入口和 operation 契约
AGENTS.md       B-roll 创作规则、提示词结构和 Agent 工作流
background.js   项目状态、资源契约与平台 capability 调用
ui/             React/Vite 创作工作台
```

平台只提供隔离存储、素材、媒体生成、Agent 和导出能力。Brief、节拍、Look、资源依赖与创作决策都属于本 App；它们不会泄漏到其他 App 或项目。

## 开发此 App

```sh
git clone git@github.com:6174/recut-vox-broll.git
cd recut-vox-broll/ui
npm ci
npm run build
```

在 Recut 主仓库中，本 App 作为 `apps/vox-broll` submodule 固定。初始化主仓库时运行：

```sh
git submodule update --init --recursive
make app-link APP=apps/vox-broll
```

`manifest.json` 是唯一运行时配置；`AGENTS.md` 是 Agent 的领域指南。修改业务行为或资源契约时，同时更新它们与本 README，保持用户路径、领域规则和实现一致。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
