# images/

> L2 | 父级: /apps/vox-broll/skills/vox-broll/references/README.md

这里是创作台给用户选择模板时显示的内置风格封面槽位。它不是生成参考图，也不参与 Agent 的具体画面推理；每张必须拥有明确的使用授权。

目录与文件名

```text
editorial-vox/
  cover.png         用户选择时的风格封面
hand-drawn-essay/
  cover.png         用户选择时的风格封面
animated-character/
  cover.png         用户选择时的风格封面
```

约定

- 固定使用 PNG，横向 16:9，建议最小 1600×900；文件名必须是 `cover.png`。
- 封面只帮助用户理解模板。具体的手绘、角色、材质、构图参考应由用户在项目中生成或上传为素材，再由 Agent 在当前工作流上下文中使用。
- Vite 会在构建时只将本 `references/images/` 目录复制至创作台静态资源；补图后运行 `npm run build`，立项弹窗会自动显示它们。
- 不放图片时界面显示明确占位，不请求外部 URL，也不影响立项或工作流。

[PROTOCOL]: 变更时更新此头部，然后检查 README.md
