# AI 短片

把一个主题做成可研究、可审阅、可继续生产的 AI 短片。Vox 编辑解说、手绘随笔和卡通角色叙事都是可冻结的导演风格模板；资料、方案、剧本、镜头和成片交付都保留在同一个 Recut 项目中。

## 在 Recut 中使用

1. 打开 [recut.video](https://recut.video)，按页面提示安装本地 Recut service。
2. 在 **Apps** tab 粘贴以下 HTTPS 地址并安装：

   ```text
   https://github.com/6174/recut-ai-short-film
   ```

3. 切到 **Project** tab，新建项目时选择 **AI 短片**，填写选题、风格模板、画幅和预期时长（30/60/90/120 秒或自定义），然后点击“复制任务书并填入 Agent”。任务书会复制并回填右侧输入框，只有你点击发送后 Agent 才会开始工作。
4. 新建 Codex 或 Claude Code 对话后，选择“从一个短片选题开始”“先建立研究资料库”或“继续当前创作”；提示词可编辑后再发送。

App 会按以下顺序引导创作，不会把未确认的想法误当成成片：

```text
立项 → 资料研究 → [用户确认] → 创作方案 → [用户选定]
→ 剧本与场景方案 → 视觉设定 → 关键画面 → 声音设计 → 场景视频 → 成片交付 → 短片交接包
```

- **立项**：冻结选题、时长、画幅和风格模板。模板包含参考图提示词、视觉提示词与导演叙事方法，后续影片保持一致。
- **资料研究**：文章、YouTube、小红书、抖音和网页先登记为全局 `reference` 素材；`create_reference` 不只记链接——文章/网页保存正文全文、图片保存真实图片字节、视频平台保存尽量完整的元数据，让资料可审阅、可复用。项目只保存素材 ID 和研究判断。资料是否足够由用户确认，不能自动跨过。
- **创作方案 / 剧本与场景方案**：先给出多个可比较的叙事方案，由用户选定；随后才把选定方案细化成带资料素材引用的约 5 秒场景计划。
- **视觉设定 / 关键画面 / 声音设计 / 场景视频**：视觉设定是本片的真实视觉圣经，而不是抽象色板；关键画面、旁白和场景视频均引用真实 Recut Media 素材。
- **成片交付 / 短片交接包**：成片交付在面板中确定性导出；`film.package` 则发布含剧本、风格、资料和素材 ID 的交接产物，供 Remotion Studio 继续代码化编排。

视频生成昂贵：默认只生成当前下一段 Scene。确认它符合预期后，再继续下一段；要批量生成时，请明确告诉 Agent。

## 项目结构

```text
manifest.json   应用身份、AI 短片立项、权限、界面入口和操作契约
skills/ai-short-film/SKILL.md  短片领域规则、资料确认/方案选定闸门、导演模板与 Remotion 交接契约
skills/ai-short-film/references/  三套风格模板的镜头、视觉、叙事、禁忌与可补充图片槽位；由 Skill 按冻结模板加载，构建后也在立项界面显示
background.js   项目状态、资源契约、全局资料素材引用与短片交接包；立项同时写入领域记录和工作台资源
ui/             React/Vite 创作工作台（暗色优先，与平台及官网共享深色语义）
```

平台提供全局素材、隔离项目状态、媒体生成、Agent 和导出能力。外部资料是可跨项目附加的全局 `reference` 素材；短片项目保存自己的资料研究、创作方案、剧本与场景方案、导演决策及其引用。跨应用使用 `recut.ai-short-film.package@1` 交接产物交接，绝不读取彼此私有数据库。

每个创作分区是独立交付物，不保存“依赖哪个 section”的资源关系，也不提供逐项删除来破坏中间状态。`workflow.context` 只给出唯一允许的线性下一步及已确认输入；素材选择、证据引用、叙事关联等复杂判断交给 Agent 在该上下文中完成。创作要求支持 `@` 临时添加当前项目条目或系统素材，它们只随本次任务书传递，不落库也不改变流程。

## 开发此 App

```sh
git clone git@github.com:6174/recut-ai-short-film.git
cd recut-ai-short-film/ui
npm ci
npm run build
```

在 Recut 主仓库中，本 App 作为 `apps/ai-short-film` submodule 固定。初始化主仓库时运行：

```sh
git submodule update --init --recursive
make app-link APP=apps/ai-short-film
```

`manifest.json` 是运行时契约；`skills/ai-short-film/SKILL.md` 是 Agent 的领域指南。修改业务行为或资源契约时，同时更新它们与本 README，保持用户路径、领域规则和实现一致。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
