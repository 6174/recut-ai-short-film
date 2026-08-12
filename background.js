/*
 * [INPUT]: 依赖平台注入的 ctx.sqlite（appstate/<appId>/storage.sqlite，全局 + 所有 Project 共用一个库）、ctx.artifacts 与受限 ctx.media.compose capability
 * [OUTPUT]: 注册 AI 短片的立项、资料确认、方案选定、剧本/镜头、媒体资源、可供 Remotion 消费的短片交接包与两轨确定性成片交付 App API 与 MCP 工具处理器
 * [POS]: vox-broll 的唯一业务后端；briefs/resources 以 project_id 分区，资源彼此不保存依赖关系，风格模板在立项时冻结为导演配置，单线 workflow.context 是唯一流程真相，复杂上下文由 Agent 读取当前阶段输入后推理
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */

function scope(ctx) {
  return ctx.project ? ctx.project.id : "";
}

// 风格模板是项目级导演配置，不是一次性的生成提示词。参考图在视觉设定阶段根据
// referenceImagePrompt 物化为当前影片的真实素材；这样模板可稳定复用，也不会
// 让不同项目错误共享私有素材。
const styleTemplates = [
  {
    id: "editorial-vox",
    name: "Vox 编辑解说",
    summary: "资料、数据与纸质拼贴推动一个清晰论点。",
    referenceGuide: "references/editorial-vox.md",
    referenceImages: [{ role: "封面", path: "references/images/editorial-vox/cover.png" }],
    referenceImagePrompt: "editorial paper collage world, torn newspaper, bold geometric data shapes, restrained red blue cream palette, no readable text, no logos",
    visualPrompt: "纸张拼贴、新闻纸纹理、撕边、网点、大尺度信息图形；一镜只服务一个论点，保留标题安全区，不生成可读正文或 Logo。",
    directorMethod: "用反常识钩子开场，以证据递进和因果转折推进；每个镜头给观众一个新的理解，不把解释堆成口号。",
  },
  {
    id: "hand-drawn-essay",
    name: "手绘随笔",
    summary: "铅笔、墨线与纸面动画，把抽象命题讲得亲近而具体。",
    referenceGuide: "references/hand-drawn-essay.md",
    referenceImages: [{ role: "封面", path: "references/images/hand-drawn-essay/cover.png" }],
    referenceImagePrompt: "hand drawn essay film reference, pencil and ink lines on warm paper, watercolor accents, tactile notebook collage, cinematic composition, no readable text",
    visualPrompt: "手绘线条、留白、纸面颗粒与少量水彩；让笔触和物件承担情绪，避免把每一句旁白都画成字卡。",
    directorMethod: "从一个可感知的生活细节进入，再扩展到观点；镜头像在纸上思考，留出停顿让观众自行连接。",
  },
  {
    id: "animated-character",
    name: "卡通角色叙事",
    summary: "固定角色与可识别的道具，适合情绪、故事和角色驱动的短片。",
    referenceGuide: "references/animated-character.md",
    referenceImages: [{ role: "封面", path: "references/images/animated-character/cover.png" }],
    referenceImagePrompt: "stylized animated short film character sheet and key environment, expressive cartoon character, cinematic lighting, coherent prop language, no readable text",
    visualPrompt: "角色外形、比例、服装、道具与场景规则必须连续；动作先于装饰，表情与构图共同推动情节。",
    directorMethod: "每一段让角色做出可见选择并承担后果；用目标、阻力、转折和余韵组织故事，避免旁白替角色完成表演。",
  },
];

function styleTemplateList() {
  return styleTemplates.map((template) => ({ ...template }));
}

function styleTemplate(id) {
  return styleTemplates.find((template) => template.id === id) || styleTemplates[0];
}

function temporaryContextMentions(input, ctx) {
  const mentions = Array.isArray(input.contextMentions) ? input.contextMentions : [];
  return mentions.flatMap((mention) => {
    if (!mention || typeof mention !== "object") return [];
    const type = String(mention.type || "").trim();
    const id = String(mention.id || "").trim();
    if (!id) return [];
    if (type === "project_item") {
      const resource = resourceByID(id, ctx);
      return [`当前项目条目：${stageLabels[resource.kind] || resource.kind}「${resource.title}」（resource id: ${resource.id}；如需完整正文先调用 resource.read）`];
    }
    if (type === "system_asset") {
      const name = String(mention.name || "系统素材").trim();
      const kind = String(mention.kind || "素材").trim();
      return [`系统素材：${name}（${kind}；assetId: ${id}）`];
    }
    return [];
  });
}

function ensureSchema(ctx) {
  ctx.sqlite.execute(
    "create table if not exists briefs (id text primary key, project_id text not null default '', topic text not null, title text not null, body text not null, created_at text not null)",
  );
  ctx.sqlite.execute("create table if not exists resources (id text primary key, project_id text not null default '', kind text not null, title text not null, content_json text not null, dependencies_json text not null, created_at text not null, retired_at text)");
  ctx.sqlite.execute("create table if not exists app_meta (key text primary key, value text not null)");
  try { ctx.sqlite.execute("alter table resources add column project_id text not null default ''"); } catch (_) { /* 新库已含该列。 */ }
  try { ctx.sqlite.execute("alter table resources add column retired_at text"); } catch (_) { /* 旧数据库已有该列，无需迁移。 */ }
  try { ctx.sqlite.execute("alter table briefs add column project_id text not null default ''"); } catch (_) { /* 新库已含该列。 */ }
}

function purgeInvalidMediaResources(ctx) {
  const marker = ctx.sqlite.query("select value from app_meta where key = ?", ["invalid-media-resource-purge-v2"]);
  if (marker.length) return;
  const rows = ctx.sqlite.query("select id, kind, content_json from resources where project_id = ? and retired_at is null", [scope(ctx)]);
  rows.forEach((row) => {
    const content = JSON.parse(row.content_json);
    const kind = String(row.kind).toLowerCase();
    const media = content?.media;
    const scenes = Array.isArray(content?.scenes) ? content.scenes : [];
    const invalidLook = kind === "look" && (!media || !media.assetId || !media.text);
    const invalidAudio = kind === "audio" && (!scenes.length || scenes.some((scene) => !scene?.audio?.assetId));
    const invalid = invalidLook || invalidAudio;
    if (invalid) ctx.sqlite.execute("delete from resources where id = ? and project_id = ?", [row.id, scope(ctx)]);
  });
  ctx.sqlite.execute("insert into app_meta (key, value) values (?, ?)", ["invalid-media-resource-purge-v2", new Date().toISOString()]);
}

function createBrief(input, ctx) {
  ensureSchema(ctx);
  const topic = String(input.topic || "").trim();
  if (!topic) throw new Error("选题不能为空");
  const details = String(input.details ?? "").trim();
  const expectedDurationSec = input.expectedDurationSec === undefined ? 60 : Number(input.expectedDurationSec);
  if (!Number.isFinite(expectedDurationSec) || expectedDurationSec <= 0) throw new Error("预期时长必须是正数");
  const aspectRatio = String(input.aspectRatio || "16:9").trim();
  if (!/^(16:9|9:16|1:1|4:5)$/.test(aspectRatio)) throw new Error("画幅必须是 16:9、9:16、1:1 或 4:5");
  const selectedStyle = styleTemplate(String(input.styleTemplateId || "editorial-vox").trim());
  const existing = latestBrief({}, ctx);
  if (existing && input.recreate !== true) throw new Error("项目已立项；如需从头重做，请在用户明确确认后传入 recreate: true。");
  if (existing) {
    // 从头重做保留历史与既有 Artifact，但将旧创作路径整体归档，防止新旧资料、
    // 方案和媒体混在同一条工作流中。
    ctx.sqlite.execute("update resources set retired_at = ? where project_id = ? and retired_at is null", [new Date().toISOString(), scope(ctx)]);
  }

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const brief = {
    id,
    topic,
    details,
    expectedDurationSec,
    aspectRatio,
    styleTemplate: selectedStyle,
    title: `${topic}，为什么值得被看见`,
    premise: details || `用一个清晰的因果链解释“${topic}”。`,
    direction: `${selectedStyle.directorMethod} 全片按约 5 秒一个关键画面与信息变化拆分，总时长 ${expectedDurationSec} 秒，画幅 ${aspectRatio}。`,
    createdAt: new Date().toISOString(),
  };
  ctx.sqlite.execute(
    "insert into briefs (id, project_id, topic, title, body, created_at) values (?, ?, ?, ?, ?, ?)",
    [id, scope(ctx), topic, brief.title, JSON.stringify(brief), brief.createdAt],
  );
  ctx.sqlite.execute(
    "insert into resources (id, project_id, kind, title, content_json, dependencies_json, created_at, retired_at) values (?, ?, ?, ?, ?, ?, ?, null)",
    [brief.id, scope(ctx), "brief", brief.title, JSON.stringify(brief), "[]", brief.createdAt],
  );
  return ctx.artifacts.publish({ type: "recut.ai-short-film.brief@1", value: brief });
}

function latestBrief(_, ctx) {
  ensureSchema(ctx);
  const rows = ctx.sqlite.query("select body from briefs where project_id = ? order by created_at desc limit 1", [scope(ctx)]);
  return rows.length ? JSON.parse(rows[0].body) : null;
}

const stageOrder = ["brief", "research", "proposals", "script", "look", "keyframes", "audio", "scenes", "delivery", "beats"];
// 英文阶段键是既有资源和 MCP 的稳定机器标识；所有面向创作者和 Agent 的
// 描述统一使用此术语表，避免界面和任务书各说各话。
const stageLabels = {
  brief: "立项", research: "资料研究", research_review: "确认资料", proposals: "创作方案",
  proposal_review: "选定方案", script: "剧本与场景方案", look: "视觉设定",
  keyframes: "关键画面", audio: "声音设计", scenes: "场景视频", delivery: "成片交付", beats: "旧内容结构",
};
const mediaSnapshotContract = {
  assetId: "string",
  text: "string",
  imageAssetIds: "string[]",
  audioAssetIds: "string[]",
};

const resourceContracts = {
  brief: {
    inputs: ["topic", "details", "expectedDurationSec", "aspectRatio", "styleTemplate"],
    output: { topic: "string", details: "string", expectedDurationSec: "number", aspectRatio: "string", styleTemplate: "object", premise: "string", direction: "string" },
  },
  research: {
    inputs: ["已确认的立项"],
    output: { researchQuestion: "string", coverageSummary: "string", status: "string", sources: "ResearchSource[]" },
    item: { field: "sources", required: ["assetId", "title", "kind", "insight", "relevance"], types: { assetId: "string", title: "string", kind: "string", insight: "string", relevance: "string" } },
  },
  proposals: {
    inputs: ["用户确认的资料研究", "已确认的立项"],
    output: { framing: "string", selectionStatus: "string", candidates: "Proposal[]" },
    item: { field: "candidates", required: ["id", "title", "logline", "thesis", "narrativeArc", "sourceIds", "whyNow"], types: { id: "string", title: "string", logline: "string", thesis: "string", narrativeArc: "string", sourceIds: "string[]", whyNow: "string" } },
  },
  script: {
    inputs: ["已选定的创作方案", "用户确认的资料研究", "已确认的立项"],
    output: { title: "string", logline: "string", screenplay: "string", scenes: "ScriptScene[]" },
    item: { field: "scenes", required: ["id", "title", "narration", "visualPlan", "purpose", "durationSec", "sourceIds"], types: { id: "string", title: "string", narration: "string", visualPlan: "string", purpose: "string", durationSec: "number", sourceIds: "string[]" } },
  },
  beats: {
    inputs: ["已确认的立项"],
    output: { hook: "string", narrative: "string", beats: "Beat[]" },
    item: { field: "beats", required: ["id", "title", "narration", "visual", "purpose", "durationSec"], types: { id: "string", title: "string", narration: "string", visual: "string", purpose: "string", durationSec: "number" } },
  },
  look: {
    inputs: ["已确认的立项", "已确认的剧本与场景方案", "已选定的风格模板"],
    output: { media: "MediaSnapshot", definition: "string", palette: "string", paperTechnique: "string", typeTreatment: "string", texture: "string", mood: "string", directorMethod: "string" },
    media: { field: "media", requiredAsset: true },
  },
  keyframes: {
    inputs: ["已确认的剧本与场景方案", "已选定的视觉设定"],
    output: { keyframes: "Keyframe[]" },
    item: { field: "keyframes", required: ["beatId", "title", "composition", "headline", "layers", "image"], types: { beatId: "string", title: "string", composition: "string", headline: "string", layers: "string[]" }, media: { field: "image", requiredAsset: true } },
  },
  audio: {
    inputs: ["已确认的剧本与场景方案", "关键画面"],
    output: { scenes: "AudioScene[]" },
    item: { field: "scenes", required: ["beatId", "narration", "music", "soundEffects", "captions", "durationSec", "audio"], types: { beatId: "string", narration: "string", music: "string", soundEffects: "string", captions: "string", durationSec: "number" }, media: { field: "audio", requiredAsset: true } },
  },
  scenes: {
    inputs: ["已选定的视觉设定", "关键画面", "已确认的声音设计"],
    output: { beatId: "string", title: "string", durationSec: "number", visualAction: "string", cutPoint: "string", video: "MediaSnapshot" },
    media: { field: "video", requiredAsset: true },
  },
  delivery: {
    inputs: ["已确认的场景视频"],
    output: { aspectRatio: "string", duration: "number", format: "string", export: "string", checklist: "string[]" },
  },
};

function requiredFields(contract) {
  return Object.keys(contract.output);
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function hasExpectedType(value, type) {
  if (type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "string[]") return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim());
  if (type.endsWith("[]")) return Array.isArray(value);
  return true;
}

function validateMediaSnapshot(label, snapshot, requiredAsset) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error(`${label} must be a MediaSnapshot object`);
  const missing = Object.entries(mediaSnapshotContract).filter(([field, type]) => field !== "assetId" && (snapshot[field] === undefined || snapshot[field] === null || (type === "string" && snapshot[field] === ""))).map(([field]) => field);
  if (requiredAsset && !hasValue(snapshot.assetId)) missing.push("assetId");
  if (missing.length) throw new Error(`${label} is missing required fields: ${missing.join(", ")}`);
  const invalid = Object.entries(mediaSnapshotContract).filter(([field, type]) => snapshot[field] !== undefined && !hasExpectedType(snapshot[field], type)).map(([field]) => field);
  if (invalid.length) throw new Error(`${label} has invalid field types: ${invalid.join(", ")}`);
}

function validateResourceContent(kind, content) {
  const contract = resourceContracts[kind];
  const missing = requiredFields(contract).filter((field) => !hasValue(content[field]));
  if (missing.length) throw new Error(`${kind} is missing required fields: ${missing.join(", ")}`);
  const invalid = Object.entries(contract.output).filter(([field, type]) => !hasExpectedType(content[field], type)).map(([field]) => field);
  if (invalid.length) throw new Error(`${kind} has invalid field types: ${invalid.join(", ")}`);
  if (contract.media) validateMediaSnapshot(`${kind}.${contract.media.field}`, content[contract.media.field], contract.media.requiredAsset);
  if (!contract.item) return;

  const items = content[contract.item.field];
  if (!Array.isArray(items)) throw new Error(`${kind}.${contract.item.field} must be an array`);
  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${kind}.${contract.item.field}[${index}] must be an object`);
    const itemMissing = contract.item.required.filter((field) => !hasValue(item[field]));
    if (itemMissing.length) throw new Error(`${kind}.${contract.item.field}[${index}] is missing required fields: ${itemMissing.join(", ")}`);
    const itemInvalid = Object.entries(contract.item.types || {}).filter(([field, type]) => !hasExpectedType(item[field], type)).map(([field]) => field);
    if (itemInvalid.length) throw new Error(`${kind}.${contract.item.field}[${index}] has invalid field types: ${itemInvalid.join(", ")}`);
    if (item[contract.item.media?.field] !== undefined) validateMediaSnapshot(`${kind}.${contract.item.field}[${index}].${contract.item.media.field}`, item[contract.item.media.field], contract.item.media.requiredAsset);
  });
}

function validateScriptDuration(content, ctx) {
  const expectedDurationSec = Number(latestBrief({}, ctx)?.expectedDurationSec || 0);
  const durationSec = (content.scenes || []).reduce((total, scene) => total + Number(scene.durationSec || 0), 0);
  if (!expectedDurationSec || durationSec !== expectedDurationSec) throw new Error(`剧本场景总时长必须等于立项的 ${expectedDurationSec} 秒；当前为 ${durationSec} 秒。`);
}

function workflowContext(_, ctx) {
  ensureSchema(ctx);
  purgeInvalidMediaResources(ctx);
  const resources = listResources({}, ctx);
  const byKind = Object.fromEntries(stageOrder.map((kind) => [kind, resources.filter((item) => String(item.kind).toLowerCase() === kind)]));
  const storedBrief = latestBrief({}, ctx);
  if (storedBrief && byKind.brief.length === 0) byKind.brief = [{ id: storedBrief.id, kind: "brief", title: storedBrief.title, content: storedBrief, createdAt: storedBrief.createdAt }];
  const latest = (kind) => byKind[kind][0] || null;
  const brief = latest("brief");
  const beats = latest("beats");
  const research = latest("research");
  const proposals = latest("proposals");
  const script = latest("script");
  const look = latest("look");
  const audio = latest("audio");
  const keyframes = latest("keyframes");
  const audioScenes = Array.isArray(audio?.content?.scenes) ? audio.content.scenes : [];
  const completedSceneBeatIDs = new Set(byKind.scenes.map((item) => item.content?.beatId).filter((id) => typeof id === "string"));
  const pendingSceneTargets = audioScenes.filter((scene) => scene?.beatId && !completedSceneBeatIDs.has(scene.beatId)).map((scene) => ({ beatId: scene.beatId, narration: scene.narration, durationSec: scene.durationSec, audio: scene.audio, keyframe: Array.isArray(keyframes?.content?.keyframes) ? keyframes.content.keyframes.find((frame) => frame?.beatId === scene.beatId)?.image : null }));
  const researchApproved = research?.content?.status === "approved";
  const selectedProposalID = String(proposals?.content?.selectedProposalId || "");
  const selectedProposal = Array.isArray(proposals?.content?.candidates) ? proposals.content.candidates.find((candidate) => candidate?.id === selectedProposalID) || null : null;
  const stage = !brief ? "brief" : !research ? "research" : !researchApproved ? "research_review" : !proposals ? "proposals" : !selectedProposal ? "proposal_review" : !script ? "script" : !latest("look") ? "look" : !latest("keyframes") ? "keyframes" : !latest("audio") ? "audio" : pendingSceneTargets.length ? "scenes" : !latest("delivery") ? "delivery" : "delivery";
  const allowedActions = stage === "research_review" ? ["approve_research"] : stage === "proposal_review" ? ["select_proposal"] : stage === "delivery" && latest("delivery") ? ["review_delivery", "publish_film_package"] : [`create_${stage}`];
  return {
    revision: `${resources.length}:${resources[0]?.createdAt || "empty"}`,
    stage,
    stageLabel: stageLabels[stage] || stage,
    nextAction: stage === "delivery" && latest("delivery") ? "review_delivery" : `create_${stage}`,
    nextActionLabel: stage === "research_review" ? "等待用户确认资料" : stage === "proposal_review" ? "等待用户选定创作方案" : stage === "delivery" && latest("delivery") ? "检查成片交付或发布短片交接包" : `创建${stageLabels[stage] || stage}`,
    gates: { researchApproved, proposalSelected: Boolean(selectedProposal), scriptReady: Boolean(script), lookReady: Boolean(look) },
    inputs: { brief, research, proposals, selectedProposal, script, beats, look, keyframes, audio },
    resourceContracts,
    styleTemplates: styleTemplateList(),
    mediaSnapshotContract,
    resources: Object.fromEntries(stageOrder.map((kind) => [kind, byKind[kind].map((item) => ({ id: item.id, title: item.title, createdAt: item.createdAt }))])),
    allowedActions,
    terminology: { note: "stage、allowedActions、资源 kind 与字段名是稳定机器标识；对用户说明、任务书和创作内容一律使用中文术语。资源不保存跨阶段依赖；Agent 只从当前 workflow.context.inputs 读取可用上下文并自行推理。", stages: stageLabels },
   pendingSceneTargets,
    mediaExecution: {
      look: { kind: "平台图片生成", generate: "根据已选 styleTemplate.referenceImagePrompt 生成本片视觉圣经，并归档为稳定的 Recut 图片素材", complete: "在视觉设定资源中记录稳定图片 assetId、styleTemplate.visualPrompt 与 directorMethod" },
      keyframes: { kind: "平台图片生成", generate: "读取 recut.project_context；按配置使用 recut.image.generate 或宿主的 Codex 原生图片能力；所有原生结果必须经 recut.media.import_image 归档", complete: "在 resource.create 之前，原生结果须先写入当前项目并获得稳定图片 assetId" },
      audio: { kind: "平台媒体生成", generate: "recut.speech.generate_async", complete: "提交成功 → 排队中 assetIds[0] → resource.create；常驻服务原位更新素材状态" },
      scenes: { kind: "平台媒体生成", generate: "recut.video.generate_async", complete: "提交成功 → 排队中 assetIds[0] → resource.create；常驻服务原位更新素材状态；Seedance 默认 output.generateAudio=true，除非用户明确要求无声视频；视频文本必须逐字引用 audio.text，禁止新增人声", alternatives: "仅在用户明确要求代码化合成时才使用合成扩展，不得以其替代生成视频。" },
    },
   inFlight: null,
  };
}

function approveResearch(input, ctx) {
  ensureSchema(ctx);
  const resource = resourceByID(String(input.id || "").trim(), ctx);
  if (resource.kind !== "research") throw new Error("只能确认资料研究资源");
  const sources = Array.isArray(resource.content?.sources) ? resource.content.sources : [];
  if (sources.length < 3) throw new Error("至少需要 3 条不同来源的资料，才能确认进入方案阶段");
  const sourceIDs = new Set(sources.map((source) => String(source?.assetId || "").trim()).filter(Boolean));
  if (sourceIDs.size < 3) throw new Error("至少需要 3 条不同的资料素材，不能重复引用同一条资料。");
  const workflow = workflowContext({}, ctx);
  if (workflow.stage !== "research_review" || workflow.inputs.research?.id !== resource.id) throw new Error("当前不在资料确认阶段，不能确认这份资料研究。");
  if (resource.content?.status === "approved") throw new Error("这份资料研究已经确认，无需重复操作。");
  return updateResource({ id: resource.id, contentPatch: { status: "approved", approvedAt: new Date().toISOString() }, gate: true }, ctx);
}

function selectProposal(input, ctx) {
  ensureSchema(ctx);
  const resource = resourceByID(String(input.id || "").trim(), ctx);
  const candidateID = String(input.candidateId || "").trim();
  if (resource.kind !== "proposals") throw new Error("只能选择创作方案资源中的候选方案");
  const candidate = Array.isArray(resource.content?.candidates) ? resource.content.candidates.find((item) => item?.id === candidateID) : null;
  if (!candidate) throw new Error("找不到要选择的方案候选");
  const workflow = workflowContext({}, ctx);
  if (workflow.stage !== "proposal_review" || workflow.inputs.proposals?.id !== resource.id) throw new Error("当前不在方案选定阶段，不能选定这个方案。");
  if (resource.content?.selectedProposalId) throw new Error("这份创作方案已经选定，不能悄悄改写既有叙事决定。");
  return updateResource({ id: resource.id, contentPatch: { selectionStatus: "selected", selectedProposalId: candidateID, selectedAt: new Date().toISOString() }, gate: true }, ctx);
}

function filmPackage(_, ctx) {
  ensureSchema(ctx);
  const workflow = workflowContext({}, ctx);
  const resources = listResources({}, ctx);
  if (workflow.stage !== "delivery" || !resources.some((resource) => resource.kind === "delivery")) throw new Error("只有完成成片交付后，才能发布短片交接包。");
  const byKind = Object.fromEntries(stageOrder.map((kind) => [kind, resources.filter((resource) => resource.kind === kind)]));
  const packageValue = {
    format: "recut.ai-short-film.package@1",
    brief: workflow.inputs.brief?.content || null,
    research: workflow.inputs.research?.content || null,
    proposal: workflow.inputs.selectedProposal || null,
    script: workflow.inputs.script?.content || null,
    style: { template: workflow.inputs.brief?.content?.styleTemplate || null, look: workflow.inputs.look?.content || null },
    assets: {
      keyframes: (byKind.keyframes[0]?.content?.keyframes || []).map((frame) => ({ sceneId: frame.beatId, assetId: frame.image?.assetId || null, prompt: frame.image?.text || null })),
      audio: (byKind.audio[0]?.content?.scenes || []).map((scene) => ({ sceneId: scene.beatId, assetId: scene.audio?.assetId || null, narration: scene.narration })),
      scenes: byKind.scenes.map((scene) => ({ sceneId: scene.content?.beatId || scene.id, assetId: scene.content?.video?.assetId || null, durationSec: scene.content?.durationSec || null })),
      deliveries: byKind.delivery.map((delivery) => ({ assetId: delivery.content?.assetId || null, settings: delivery.content?.settings || null })),
    },
    remotionHandoff: "在 Remotion Studio 新建项目后，读取此短片交接包；将关键画面、声音设计、场景视频中的稳定 assetId 作为素材输入，复用剧本场景的时序与风格模板的视觉/导演约束。Remotion 负责代码化编排，不重写已确认的叙事决定。",
  };
  return ctx.artifacts.publish({ type: "recut.ai-short-film.package@1", value: packageValue });
}

function prepareResource(input, ctx) {
  ensureSchema(ctx);
  const kind = normalizeResourceKind(String(input.kind || "").trim());
  if (!kind || !resourceContracts[kind] || kind === "brief" || kind === "beats") throw new Error("不是可创建的短片阶段。");
  const workflow = workflowContext({}, ctx);
  if (!workflow.allowedActions.includes(`create_${kind}`)) throw new Error(`当前处于“${workflow.stageLabel}”，下一步是“${workflow.nextActionLabel}”。`);
  const instruction = String(input.instruction || "无额外要求");
  const contextMentions = temporaryContextMentions(input, ctx);
  const sceneTargets = (() => {
    if (kind.toLowerCase() !== "scenes") return [];
    const resources = listResources({}, ctx);
    const audio = resources.find((item) => item.kind === "audio");
    const keyframes = resources.find((item) => item.kind === "keyframes");
    const completed = new Set(resources.filter((item) => item.kind === "scenes").map((item) => item.content?.beatId));
    return (audio?.content?.scenes || []).filter((scene) => scene?.beatId && !completed.has(scene.beatId)).map((scene) => ({ beatId: scene.beatId, narration: scene.narration, durationSec: scene.durationSec, audio: scene.audio, keyframe: (keyframes?.content?.keyframes || []).find((frame) => frame?.beatId === scene.beatId)?.image }));
  })();
  const batch = /全部|所有|一次生成|all/i.test(instruction);
  const stageWorkflow = {
    research: "先建立足够的证据库，再讨论故事。检索文章、YouTube、小红书、抖音、论文或原始资料；每条来源必须先用 recut.media.create_reference 登记为全局 reference 素材，资料研究仅保存 assetId、标题、类型、与本片相关的事实洞见和可信度/偏见判断。至少收集 3 条不同来源、覆盖支持与反例/限制后保存 status: 'draft' 并停下，绝不提前写剧本。",
    proposals: "基于用户已确认的资料研究，提出 2–3 个显著不同的短片方案。每个候选给一句话梗概、核心论点、叙事弧、来源 assetId 列表与为什么现在值得看；保存 selectionStatus: 'pending' 并停下让用户选定，不能直接开始写剧本。",
    script: "只使用用户选定的创作方案和已确认的资料研究，写出可生产的剧本与场景方案。每一项 scenes[] 是约 5 秒的一个信息变化，必须带实际引用的 sourceIds；所有 durationSec 合计必须匹配立项的 expectedDurationSec。不要生成图片、声音或视频。",
    look: "读取立项中冻结的 styleTemplate。为本片生成一张匹配画幅的完整视觉圣经参考图：它必须包含全片主体、道具、信息元素、背景材料与层级，而不只是配色。media.text 必须保留原始提示词；definition 和导演方法必须结合 styleTemplate.visualPrompt 与 directorMethod。不要生成可读正文、标志或水印。完成后停下。",
    keyframes: "每个节拍一张关键画面；一个关键画面只服务约 5 秒的单一信息变化，绝不以一张关键画面覆盖 10 秒或更长的叙事。先读取 recut.project_context，按当前图片生成方案逐张生成。平台图片路线使用 recut.image.generate；Codex 原生方案使用宿主提供的图片能力，随后将最终文件写入当前 Recut 项目目录并调用 recut.media.import_image。无论哪种路径，图片必须先成为稳定的 Recut 媒体素材并取得真实 assetId，再保存；绝不伪造 assetId 或只交付对话预览。每个 keyframes[] 项的 image 必须是完整 MediaSnapshot，image.assetId 指向该节拍的新图；text 是该图的原始提示词；imageAssetIds 可引用真实视觉参考素材；audioAssetIds 为空数组。不要保存其他 section 的资源 ID；所需上下文来自 workflow.context。绝不把文字画面描述当成关键画面保存。",
    audio: "每个场景都必须先生成真实可播放的旁白：从 recut.project_context.media.defaultRoutes 找到 speech.generate 的 credentialId，调用 recut.media.list_voices 取得 voiceId；逐段调用 recut.speech.generate_async 后立即取得稳定 assetId 并保存 scenes[]。每项 audio 必须是完整 MediaSnapshot：assetId 为刚提交的音频，text 为旁白原文，imageAssetIds/audioAssetIds 为空数组。不要保存其他 section 的资源 ID；所需上下文来自 workflow.context。常驻服务会原位更新状态；只有音频已完成时才可将它作为场景视频输入。音乐和音效可以是编辑指令，但不能替代旁白音频。生成失败时不得保存空声音设计资源，应如实报告。",
    scenes: `视频生成昂贵，默认只生成第一段并停下等待用户确认。每个场景视频只对应一个约 5 秒的场景与关键画面；时长更长时继续拆分，不得靠一个场景视频覆盖多个信息变化。${batch ? "用户已明确要求一次生成全部剩余段；逐段生成，但每段必须独立调用 resource.create，绝不能合并为一个含多段的场景视频资源。" : "不要循环生成其余段，不要合并为一个含多段的场景视频资源。"} 执行顺序不可替换：先调用 recut.video.generate_async，传入该段 keyframe.assetId 与已完成 audio.assetId。调用的视频提示词必须把该场景 audio.text（若为空则 narration）原样逐字写在“唯一人声/逐字台词”段落中，并明确：使用附带参考音频作为唯一人声；禁止新增对白、歌词、耳语、翻译或不可辨识人声；只生成与画面动作相符的非语言效果声。若路线使用 Seedance，output.generateAudio 默认为 true，只有用户明确要求无声视频才传 false；Gemini 不传此字段。提交响应会带稳定 assetIds[0]，立刻调用 resource.create 保存独立场景视频资源，不能等待轮询完成。recut.media.get_job 只用于读取并报告该素材的排队中/生成中/已完成/失败状态。禁止使用 HyperFrames、ffmpeg、浏览器自动化、终端脚本或本地渲染替代该 API 调用。顶层字段为 beatId、title、durationSec、visualAction、cutPoint、video；video 必须是完整 MediaSnapshot 且 assetId 指向刚提交的视频。`,
    delivery: "最终时间线、画幅、时长、格式和可执行的交付前检查表。画幅必须沿用立项的 aspectRatio。",
  }[kind] || "一份面向审阅的清晰创作产出。";
  const contract = resourceContracts[kind];
  const outputFields = contract ? Object.entries(contract.output).map(([field, type]) => `${field}: ${type}`).join("；") : "一份可审阅的阶段资源";
  const itemFields = contract?.item ? `\n数组项：${contract.item.field}[] 每项为 { ${Object.entries(contract.item.types || {}).map(([field, type]) => `${field}: ${type}`).join("；")} }${contract.item.optional?.length ? `；可选 ${contract.item.optional.join("、")}` : ""}` : "";
 const interfaceText = contract ? `输入：${contract.inputs.join("；")}\n输出对象：${outputFields}${itemFields}` : "输出：一份可审阅的阶段资源。";
  const executionMethod = kind === "scenes" ? "这是平台视频生成任务：recut.video.generate_async 成功提交后立刻用返回的排队中 assetIds[0] 调用 resource.create；常驻服务原位更新状态。除非用户明确要求 HyperFrames，否则不要把它解释为 HyperFrames 合成任务。" : kind === "keyframes" ? "这是按平台配置执行的图片生成任务：先读取 recut.project_context；平台图片路线调用 recut.image.generate，Codex 原生方案使用宿主提供的图片能力，然后将最终文件写入当前项目并调用 recut.media.import_image。无论哪种路径，先确保图片成为稳定的 Recut 媒体素材并取得真实 assetId，再保存；绝不只交付对话预览或伪造 ID。" : kind === "audio" ? "这是平台语音生成任务：调用 recut.speech.generate_async 后立刻保存返回的稳定 assetId；常驻服务原位更新状态。" : "遵循当前阶段契约。";
 return {
    intent: "resource.create",
    prompt: `创作阶段：${stageLabels[kind]}\n执行方式：${executionMethod}\n可用上下文：先读取 workflow.context.inputs；不要要求用户或 UI 勾选前序资源，也不要把其他 section 的资源 ID 写入本阶段资源。复杂取材、证据选择和引用判断由你自行完成。\n${contextMentions.length ? `本次 @ 临时上下文（仅本次任务可用，不写入资源）：\n- ${contextMentions.join("\n- ")}\n` : ""}用户要求：${instruction}\n${sceneTargets.length ? `待生成场景（默认只取第一项）：${JSON.stringify(batch ? sceneTargets : sceneTargets.slice(0, 1))}\n` : ""}本阶段交付：${stageWorkflow}\n资源接口：\n${interfaceText}\n只完成这个阶段；产出必须可供下一阶段使用。`,
  };
}

function createResource(input, ctx) {
  ensureSchema(ctx);
  const kind = String(input.kind || "").toLowerCase();
  if (!kind) throw new Error("资源类型不能为空");
  const contract = resourceContracts[kind];
  if (!contract || kind === "brief" || kind === "beats" || kind === "delivery") throw new Error(`未知或不可创建的资源阶段：${kind}`);
  if (!input.content || typeof input.content !== "object") throw new Error(`${stageLabels[kind] || kind} 需要结构化内容`);
  const workflow = workflowContext({}, ctx);
  const expectedAction = `create_${kind}`;
  if (!workflow.allowedActions.includes(expectedAction)) throw new Error(`当前处于“${workflow.stageLabel}”，不允许创建“${stageLabels[kind] || kind}”。下一步是“${workflow.nextActionLabel}”。`);
  if (kind === "research" && input.content.status !== "draft") throw new Error("资料研究创建时必须处于 draft，是否足够只能由用户确认。");
  if (kind === "proposals" && (input.content.selectionStatus !== "pending" || input.content.selectedProposalId)) throw new Error("创作方案创建时必须处于 pending，选定方案只能通过 proposal.select。 ");
  validateResourceContent(kind, input.content);
  if (kind === "script") validateScriptDuration(input.content, ctx);
  return persistResource(kind, input.title, input.content, ctx);
}

function persistResource(kind, title, content, ctx) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const resource = { id, kind, title: String(title), content, createdAt: new Date().toISOString() };
  // dependencies_json 是旧库的兼容列；新资源一律写空数组，不再构成工作流关系。
  ctx.sqlite.execute("insert into resources (id, project_id, kind, title, content_json, dependencies_json, created_at, retired_at) values (?, ?, ?, ?, ?, ?, ?, null)", [resource.id, scope(ctx), resource.kind, resource.title, JSON.stringify(resource.content), "[]", resource.createdAt]);
  return ctx.artifacts.publish({ type: `recut.ai-short-film.${resource.kind.toLowerCase()}@1`, value: resource });
}

function normalizeResourceKind(kind) {
  // 0.15 将早期 Beats 归并为可生产 Script。旧项目保留其资源可读性，
  // 但新建资源不会再走这条已废弃阶段。
  return String(kind || "").toLowerCase() === "beats" ? "script" : String(kind || "").toLowerCase();
}

function resourceByID(id, ctx) {
  const rows = ctx.sqlite.query("select id, kind, title, content_json, created_at from resources where id = ? and project_id = ? and retired_at is null", [id, scope(ctx)]);
  if (!rows.length) throw new Error(`resource ${id} was not found`);
  const row = rows[0];
  return { id: row.id, kind: normalizeResourceKind(row.kind), title: row.title, content: JSON.parse(row.content_json), createdAt: row.created_at };
}

function readResource(input, ctx) {
  ensureSchema(ctx);
  const id = String(input.id || "").trim();
  if (!id) throw new Error("resource id is required");
  return resourceByID(id, ctx);
}

function findItemIndex(items, match) {
  if (!Array.isArray(items)) return -1;
  const id = String(match?.id || "").trim();
  const beatID = String(match?.beatId || "").trim();
  if (!id && !beatID) throw new Error("item.match requires id or beatId");
  return items.findIndex((item) => item && typeof item === "object" && (!id || item.id === id) && (!beatID || item.beatId === beatID));
}

function updateResource(input, ctx) {
  ensureSchema(ctx);
  const id = String(input.id || "").trim();
  if (!id) throw new Error("resource id is required");
  const resource = resourceByID(id, ctx);
  const contentPatch = input.contentPatch && typeof input.contentPatch === "object" && !Array.isArray(input.contentPatch) ? input.contentPatch : null;
  const itemPatch = input.itemPatch && typeof input.itemPatch === "object" && !Array.isArray(input.itemPatch) ? input.itemPatch : null;
  if (!contentPatch && !itemPatch && !String(input.title || "").trim()) throw new Error("resource.update requires title, contentPatch, or itemPatch");
  if (!input.gate && resource.kind === "research" && (Object.hasOwn(contentPatch || {}, "status") || Object.hasOwn(contentPatch || {}, "approvedAt"))) throw new Error("资料确认只能通过 research.approve。 ");
  if (!input.gate && resource.kind === "proposals" && (Object.hasOwn(contentPatch || {}, "selectionStatus") || Object.hasOwn(contentPatch || {}, "selectedProposalId") || Object.hasOwn(contentPatch || {}, "selectedAt"))) throw new Error("方案选定只能通过 proposal.select。 ");
  if (resource.kind === "research" && resource.content?.status === "approved") throw new Error("资料研究已经确认；如需修改，请新建资料研究并重新确认。");
  if (resource.kind === "proposals" && resource.content?.selectedProposalId) throw new Error("创作方案已经选定；如需改写叙事，请新建创作方案并重新选定。");
  const content = JSON.parse(JSON.stringify(resource.content));
  if (contentPatch) Object.assign(content, contentPatch);
  if (itemPatch) {
    const collection = String(itemPatch.collection || "").trim();
    const patch = itemPatch.patch;
    if (!collection || !patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("itemPatch requires collection and object patch");
    const index = findItemIndex(content[collection], itemPatch.match);
    if (index < 0) throw new Error(`no matching item in ${collection}`);
    content[collection][index] = { ...content[collection][index], ...patch };
  }
  validateResourceContent(resource.kind, content);
  if (resource.kind === "script") validateScriptDuration(content, ctx);
  const title = String(input.title || "").trim() || resource.title;
  ctx.sqlite.execute("update resources set title = ?, content_json = ? where id = ? and project_id = ?", [title, JSON.stringify(content), id, scope(ctx)]);
  const updated = { ...resource, title, content };
  return ctx.artifacts.publish({ type: `recut.ai-short-film.${resource.kind.toLowerCase()}@1`, value: updated });
}

function listResources(_, ctx) {
  ensureSchema(ctx);
  purgeInvalidMediaResources(ctx);
  const resources = ctx.sqlite.query("select id, kind, title, content_json, created_at from resources where project_id = ? and retired_at is null order by created_at desc", [scope(ctx)]).map((row) => ({ id: row.id, kind: normalizeResourceKind(row.kind), title: row.title, content: JSON.parse(row.content_json), createdAt: row.created_at }));
  const storedBrief = latestBrief({}, ctx);
  if (storedBrief && !resources.some((resource) => resource.id === storedBrief.id)) resources.push({ id: storedBrief.id, kind: "brief", title: storedBrief.title, content: storedBrief, createdAt: storedBrief.createdAt });
  return resources.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

function timelineDuration(track) {
  return (Array.isArray(track) ? track : []).reduce((total, clip) => Math.max(total, Number(clip.startSec || 0) + Number(clip.durationSec || 0)), 0);
}

function exportDelivery(input, ctx) {
  ensureSchema(ctx);
  if (!ctx.media || typeof ctx.media.compose !== "function") throw new Error("平台导出能力不可用，请重启 Recut 后重试。");
  const workflow = workflowContext({}, ctx);
  if (!workflow.allowedActions.includes("create_delivery")) throw new Error(`当前处于“${workflow.stageLabel}”，下一步是“${workflow.nextActionLabel}”。`);
  const videoTimeline = Array.isArray(input.videoTimeline) ? input.videoTimeline : [];
  const audioTimeline = Array.isArray(input.audioTimeline) ? input.audioTimeline : [];
  const settings = input.settings && typeof input.settings === "object" && !Array.isArray(input.settings) ? input.settings : {};
  if (!videoTimeline.length) throw new Error("至少需要一个场景视频片段才能导出成片。");
  const asset = ctx.media.compose({ videoTimeline, audioTimeline, settings });
  ctx.project.setCover({ assetId: asset.id });
  const duration = timelineDuration(videoTimeline);
  const aspectRatio = `${settings.width || 1920}:${settings.height || 1080}`;
  const content = {
    aspectRatio,
    duration,
    format: "MP4 / H.264 + AAC",
    export: `已导出为新素材：${asset.id}`,
    checklist: ["视频轨已按顺序合成并保留原声", audioTimeline.length ? "音频轨已与视频原声混合" : "未额外选择音频轨", `导出尺寸：${aspectRatio}`, `帧率：${settings.fps || 30} fps`],
    assetId: asset.id,
    videoTimeline,
    audioTimeline,
    settings,
  };
  validateResourceContent("delivery", content);
  persistResource("delivery", `成片交付 · ${new Date().toLocaleString("zh-CN")}`, content, ctx);
  return asset;
}

recut.operation.register("brief.create", createBrief);
recut.operation.register("brief.latest", latestBrief);
recut.operation.register("workflow.context", workflowContext);
recut.operation.register("research.approve", approveResearch);
recut.operation.register("proposal.select", selectProposal);
recut.operation.register("film.package", filmPackage);
recut.operation.register("resource.prepare", prepareResource);
recut.operation.register("resource.create", createResource);
recut.operation.register("resource.read", readResource);
recut.operation.register("resource.update", updateResource);
recut.operation.register("resource.list", listResources);
recut.operation.register("delivery.export", exportDelivery);
