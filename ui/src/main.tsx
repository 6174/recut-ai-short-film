/**
 * [INPUT]: 依赖 React、recut UI SDK、共享 Asset SSE 缓存、资源卡片、资源弹窗与同级 Skill 风格参考图
 * [OUTPUT]: 对外提供 AI 短片多面板工作台、立项/资料研究人工确认闸门、两轨成片交付与短片交接包入口；起始表单只生成、复制并回填中文任务书，绝不提交 Agent turn，刷新后按资源 ID 同步已打开详情
 * [POS]: vox-broll 的项目 UI 编排层；将风格、资料、方案、剧本和生成媒体放在一条不可跳步的创作链上；立项时展示构建自 Skill 同级 references 的本地风格参考图，为资源预览建立唯一 Asset SSE 缓存，最终阶段只调用 background API
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { CreateResourceDialog, type ProjectBriefInput, ResourcePreviewDialog } from "./resource-dialogs";
import type { ContextMention } from "./context-mentions";
import { recut } from "./recut-sdk";
import { StagePanel, type Stage } from "./stage-panel";
import { DeliveryExportDialog } from "./timeline-export";
import { MediaAssetEventsProvider } from "./use-media-asset-events";
import "./style.css";

export type Resource = { id: string; kind: string; title: string; content: unknown; createdAt?: string };
type CapabilityEvent = { type?: string; appId?: string; kind?: string; name?: string };

const stages: Stage[] = [
  { kind: "Brief", eyebrow: "开始", label: "立项", summary: "选题、风格模板、画幅与时长", action: "开始立项", empty: "点击定义这支短片" },
  { kind: "Research", eyebrow: "第一步", label: "资料研究", summary: "先建立可复用的资料与证据库", action: "开始研究", empty: "先收集足够资料，再进入方案" },
  { kind: "Proposals", eyebrow: "第二步", label: "创作方案", summary: "从资料中提出不同的讲述路径", action: "提出方案", empty: "资料确认后，再提出方案" },
  { kind: "Script", eyebrow: "第三步", label: "剧本与场景方案", summary: "把选定方案变成可生产的场景", action: "细化剧本", empty: "选择一个方案后，细化剧本" },
  { kind: "Look", eyebrow: "第四步", label: "视觉设定", summary: "把导演模板落成这支片的视觉圣经", action: "生成参考图", empty: "剧本确认后，生成风格参考图" },
  { kind: "Keyframes", eyebrow: "第五步", label: "关键画面", summary: "每个场景应该长什么样", action: "添加关键画面", empty: "点击添加第一张关键画面" },
  { kind: "Audio", eyebrow: "第六步", label: "声音设计", summary: "先确定每段声音如何推动理解", action: "添加声音", empty: "点击添加配音或音乐" },
  { kind: "Scenes", eyebrow: "第七步", label: "场景视频", summary: "让声音和关键画面成为连续短场景", action: "生成场景视频", empty: "点击生成第一个场景视频" },
  { kind: "Delivery", eyebrow: "最后一步", label: "成片交付", summary: "尺寸、格式和交付前检查", action: "设置交付", empty: "点击设置交付格式" },
];
const examples = ["做口播短视频你最应该关注的三件事", "为什么 AI 视频工作流总是卡在最后一步？", "一条 Vox 风格视频如何让复杂概念变简单？"];

function App() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [preview, setPreview] = useState<Resource | null>(null);
  const [creatingStage, setCreatingStage] = useState<Stage | null>(null);
  const [projectBriefOpen, setProjectBriefOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [diagnostic, setDiagnostic] = useState("等待资源连接");
  const refresh = async () => {
    setDiagnostic("正在请求资源列表");
    console.warn("[vox-broll] resource refresh started");
    try {
      const nextResources = await recut.state.query("resource.list");
      setResources(nextResources);
      setProjectBriefOpen(nextResources.length === 0);
      setPreview((current) => current ? nextResources.find((resource) => resource.id === current.id) ?? null : null);
      setDiagnostic(`资源已同步：${nextResources.length} 项`);
      console.warn(`[vox-broll] resource refresh completed count=${nextResources.length}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "未知错误";
      setDiagnostic(`资源同步失败：${message}`);
      console.error("[vox-broll] resource refresh failed", cause);
    }
  };

  useEffect(() => {
    window.addEventListener("recut-sdk-ready", refresh);
    const unsubscribe = recut.events.subscribe((event) => {
      const capability = event as CapabilityEvent;
      if (capability.type === "app.capability.completed" && capability.appId === "recut.vox-broll" && capability.kind === "operation" && ["brief.create", "resource.create", "resource.update", "research.approve", "proposal.select", "delivery.export"].includes(String(capability.name))) void refresh();
    });
    return () => { window.removeEventListener("recut-sdk-ready", refresh); unsubscribe(); };
  }, []);

  const resourcesFor = (stage: Stage) => resources.filter((resource) => resource.kind.toLowerCase() === stage.kind.toLowerCase());
  const create = async (stage: Stage, instruction: string, mentions: ContextMention[]) => {
    const prepared = await recut.background.call("resource.prepare", { kind: stage.kind, instruction, contextMentions: mentions });
    await recut.agent.compose({ prompt: prepared.prompt });
    setStatus("创作请求已填入右侧 Agent 输入框；发送后资源会自动出现。 ");
  };
  const startProjectBrief = async (input: ProjectBriefInput) => {
    const prompt = `我要制作一支 AI 短片。\n\n立项信息：\n- 选题方向：${input.topic}\n- 补充信息：${input.details || "无额外补充"}\n- 风格模板：${input.styleTemplateId}\n- 成片画幅：${input.aspectRatio}\n- 预期时长：${input.expectedDurationSec} 秒\n\n请严格执行：\n1. 先调用 workflow.context。\n2. 仅调用 brief.create，传入以上 topic、details、styleTemplateId、aspectRatio、expectedDurationSec，冻结本片的导演配置。\n3. 然后到此停下，等待我确认开始资料研究。不要提出创作方案、写剧本、生成视觉设定、关键画面、声音或视频。\n\n资料研究开始后，先用 recut.media.create_reference 将文章、YouTube、小红书、抖音或网页资料登记成全局 reference 素材：正文全文写入 content、图片字节写入 imageData（base64）、视频平台补齐频道/时长/播放/点赞等完整元数据；再保存仅含 assetId 和研究结论的资料研究资源。必须让我确认资料足够后才进入创作方案。`;
    if (!navigator.clipboard?.writeText) throw new Error("当前环境不支持自动复制，请手动复制右侧输入框中的任务书");
    await navigator.clipboard.writeText(prompt);
    await recut.agent.compose({ prompt });
    setStatus("任务书已复制，并已写入右侧 Agent 输入框；请确认后手动发送。 ");
  };
  const exportDelivery = async (input: Record<string, unknown>) => {
    const asset = await recut.background.call("delivery.export", input);
    await refresh();
    setStatus("成片已作为新的素材导出。");
    return asset;
  };
  const troubleshootExport = async (message: string) => {
    try {
      await recut.agent.compose({ prompt: `请只排查并修复 AI 短片最终导出失败的问题，不要重新创作视频或改动时间线。导出由平台两轨合成执行，诊断如下：${message}\n若是编码或素材问题，定位原因并修复到可以重新导出。` });
      setStatus("导出诊断已填入右侧 Agent 输入框；确认发送后它只会处理环境或导出错误，不会重做创作内容。");
    } catch { setStatus("导出失败，且当前没有可用的 Codex 会话；请创建会话后重试导出。 "); }
  };
  const approveResearch = async (resource: Resource) => {
    await recut.background.call("research.approve", { id: resource.id });
    await refresh();
    setStatus("资料已确认；现在可以提出不同的短片方案。");
  };
  const selectProposal = async (resource: Resource, candidateId: string) => {
    await recut.background.call("proposal.select", { id: resource.id, candidateId });
    await refresh();
    setStatus("方案已选定；现在可以细化剧本与场景方案。");
  };

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,oklch(0.99_0.012_151),transparent_30rem)] p-4 sm:p-6"><div className="mx-auto max-w-[1440px]">
    <header className="mb-4 flex items-end justify-between gap-6 border-b border-border/80 pb-4"><div><p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-primary">RECUT 应用 / AI 短片</p><h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">短片创作台</h1><p className="mt-1 text-sm text-muted-foreground">从立项、资料研究和方案选定，到关键画面、声音设计、场景视频与成片交付。</p><p className="mt-1 font-mono text-[10px] text-muted-foreground" data-testid="resource-diagnostic">诊断 · {diagnostic}</p></div></header>
    <div className="grid gap-5 xl:grid-cols-2">
      <StagePanel onCreate={() => setCreatingStage(stages[0])} onPreview={setPreview} resources={resourcesFor(stages[0])} stage={stages[0]} />
      {stages.slice(1, -1).map((stage) => <StagePanel key={stage.kind} onCreate={() => setCreatingStage(stage)} onPreview={setPreview} resources={resourcesFor(stage)} stage={stage} />)}
      <StagePanel onCreate={() => setDeliveryOpen(true)} onPreview={setPreview} resources={resourcesFor(stages[stages.length - 1])} stage={stages[stages.length - 1]} />
    </div>
    {status && <p className="mt-5 text-sm text-muted-foreground" role="status">{status}</p>}
  </div>
  <ResourcePreviewDialog onApproveResearch={(resource) => void approveResearch(resource)} onOpenChange={(open) => !open && setPreview(null)} onSelectProposal={(resource, candidateId) => void selectProposal(resource, candidateId)} resource={preview} />
  <CreateResourceDialog examples={creatingStage?.kind === "Brief" ? examples : []} isBrief={creatingStage?.kind === "Brief" || projectBriefOpen} isLook={creatingStage?.kind === "Look"} onCreate={(instruction, mentions) => creatingStage ? create(creatingStage, instruction, mentions) : Promise.resolve()} onOpenChange={(open) => { if (!open) { setCreatingStage(null); setProjectBriefOpen(false); } }} onStartBrief={startProjectBrief} open={Boolean(creatingStage) || projectBriefOpen} resources={resources} stage={creatingStage?.label || "选题与方向"} />
  <DeliveryExportDialog onExport={exportDelivery} onOpenChange={setDeliveryOpen} onTroubleshoot={troubleshootExport} open={deliveryOpen} resources={resources} />
  </main>;
}

createRoot(document.getElementById("root")!).render(<MediaAssetEventsProvider><App /></MediaAssetEventsProvider>);
