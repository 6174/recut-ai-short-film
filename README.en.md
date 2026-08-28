<div align="center">

<img src="./assets/logo.jpg" alt="Recut logo" width="112" />

# AI Short Film

**Turn a topic into a research-backed, reviewable AI short film**

Research → proposals → script → shots → delivery, with human gates

[中文](./README.md) · **English**

</div>

![AI Short Film](./assets/short-film.jpg)

## What it is

AI Short Film is Recut's **narrative short App** (`project` type). No one-click black box — it moves a topic through **Brief → Research → Proposals → Script & Scenes → Look → Keyframes → Audio → Scenes → Delivery** as a linear, reviewable workflow.

- **Reusable research**: articles, YouTube, Xiaohongshu, Douyin and web pages are registered as global `reference` Assets (full body, image bytes, platform metadata); the project stores `assetId` + conclusions.
- **Human gates**: research needs `research.approve`; proposals need `proposal.select`.
- **Composable output**: deterministic `delivery.export` plus a `film.package` handoff (script, look, assetIds) for Editor or Remotion.

> Ships with Recut. Published at [6174/recut-ai-short-film](https://github.com/6174/recut-ai-short-film). Styles: `editorial-vox` / `hand-drawn-essay` / `animated-character`.

## Why AI Short Film

### Research first

Build a research library before creative — script beats can cite source Assets.

### Frozen style

Brief locks style template, aspect ratio and runtime so later shots stay consistent.

### Each phase is a deliverable

Phases don't depend on each other via section links; `workflow.context` gives the single allowed next step.

## From idea to finished film

1. **Brief** (`brief.create`): topic, style template, aspect ratio, expected duration.
2. **Research** (`resource.create: research`): register each source via `recut.media.create_reference`.
3. **Approve** (`research.approve`) → **Proposals** → **Select** (`proposal.select`).
4. **Script & scenes → look → keyframes → audio → scenes**: generate and review one scene at a time.
5. **Delivery** (`delivery.export`) & **handoff** (`film.package`).

## Capabilities

| Capability | What you can do | Key operations |
| --- | --- | --- |
| **Brief & context** | Lock topic/style/ratio/duration, read next step & contracts | `brief.create` · `workflow.context` |
| **Research** | Register global references, save conclusions | `recut.media.create_reference` → `resource.create: research` · `research.approve` |
| **Proposals & script** | Compare proposals, refine into ~5s beats | `resource.create: proposals/script` · `proposal.select` |
| **Look & media** | Look, keyframes, audio, scene videos step by step | `resource.create: look/keyframes/audio/scenes` · `resource.update` |
| **Delivery & handoff** | Deterministic export, publish handoff package | `delivery.export` · `film.package` |

> Full contract: `manifest.json` → `operations`. Agent rules: `skills/ai-short-film/SKILL.md`.

## Quick start

### Open in Recut

1. Install and launch Recut (see root [README](../../README.en.md#install-recut)).
2. Create a new project → **AI Short Film**, fill in topic, style, ratio, duration.
3. "Copy brief to Agent" and confirm in the Agent to start.

### Let the Agent help

> "I want an AI short film about [topic]. Call `workflow.context` and only do Brief (`brief.create`), then stop and wait for my confirmation."

Each later phase advances only the single allowed next step from `workflow.context`.

## Tour

- **Phase nav**: linear steps with gate states.
- **Research & proposals**: sources, proposal comparison, selection.
- **Script & shots**: beats, look, keyframes, audio.
- **Delivery**: preview, export, handoff package.

![AI Short Film workspace](./assets/short-film.jpg)
<sub>Linear workflow from topic to delivery.</sub>

## FAQ

**Why stop after research?** You decide if research is sufficient — explicit `research.approve` unlocks proposals.

**Batch-generate all scenes?** Video is expensive — default is one scene at a time. Confirm, then continue; ask explicitly for batch.

**Hand off to Editor or Remotion?** Use `film.package` after delivery, then `film.package.import` in Editor or continue in Remotion.

## For developers

`project` type App; state is project-scoped.

```sh
make app-link APP=apps/ai-short-film
make dev
cd apps/ai-short-film/ui && npm ci && npm run build
```

- Runtime entry: `ui/dist/index.html`.
- Contracts: `manifest.json` · `background.js` · `skills/ai-short-film/SKILL.md`.

[Back to root README](../../README.en.md) · [App map](../../README.en.md#app-map)
