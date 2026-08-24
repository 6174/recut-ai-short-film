/**
 * [INPUT]: 依赖 React、recut UI SDK、共享 Asset SSE 缓存、资源卡片、资源弹窗与同级 Skill 风格参考图
 * [OUTPUT]: 对外提供 AI 短片多面板工作台、立项/资料研究人工确认闸门、两轨成片交付与短片交接包入口；起始表单只生成、复制并回填中文任务书，绝不提交 Agent turn，刷新后按资源 ID 同步已打开详情
 * [POS]: ai-short-film 的项目 UI 编排层；将风格、资料、方案、剧本和生成媒体放在一条不可跳步的创作链上；立项时展示构建自 Skill 同级 references 的本地风格参考图，为资源预览建立唯一 Asset SSE 缓存，最终阶段只调用 background API
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import { CreateResourceDialog, type ProjectBriefInput, ResourcePreviewDialog } from "./resource-dialogs";
import type { ContextMention } from "./context-mentions";
import { recut, useRecutLocale, type Locale } from "./recut-sdk";
import { StagePanel, type Stage } from "./stage-panel";
import { DeliveryExportDialog } from "./timeline-export";
import { MediaAssetEventsProvider } from "./use-media-asset-events";
import { t } from "./i18n";
import "./style.css";

export type Resource = { id: string; kind: string; title: string; content: unknown; createdAt?: string };
type CapabilityEvent = { type?: string; appId?: string; kind?: string; name?: string };

const stageKinds: Array<"Brief" | "Research" | "Proposals" | "Script" | "Look" | "Keyframes" | "Audio" | "Scenes" | "Delivery"> = ["Brief", "Research", "Proposals", "Script", "Look", "Keyframes", "Audio", "Scenes", "Delivery"];

function buildStages(locale: Locale): Stage[] {
  return stageKinds.map((kind) => ({
    kind,
    eyebrow: t(locale, `stage.${kind}.eyebrow`),
    label: t(locale, `stage.${kind}.label`),
    summary: t(locale, `stage.${kind}.summary`),
    action: t(locale, `stage.${kind}.action`),
    empty: t(locale, `stage.${kind}.empty`),
  }));
}

function App() {
  const locale = useRecutLocale();
  useEffect(() => { document.title = t(locale, "app.name"); }, [locale]);
  const stages = useMemo(() => buildStages(locale), [locale]);
  const examples = useMemo(() => [t(locale, "examples.0"), t(locale, "examples.1"), t(locale, "examples.2")], [locale]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [preview, setPreview] = useState<Resource | null>(null);
  const [creatingStage, setCreatingStage] = useState<Stage | null>(null);
  const [projectBriefOpen, setProjectBriefOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [diagnostic, setDiagnostic] = useState(t(locale, "status.waitingForConnection"));
  const refresh = async () => {
    setDiagnostic(t(locale, "status.requestingResources"));
    console.warn("[ai-short-film] resource refresh started");
    try {
      const nextResources = await recut.state.query("resource.list");
      setResources(nextResources);
      setProjectBriefOpen(nextResources.length === 0);
      setPreview((current) => current ? (nextResources as Resource[]).find((resource) => resource.id === current.id) ?? null : null);
      setDiagnostic(t(locale, "status.resourcesSynced", { count: nextResources.length }));
      console.warn(`[ai-short-film] resource refresh completed count=${nextResources.length}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t(locale, "status.unknownError");
      setDiagnostic(t(locale, "status.syncFailed", { message }));
      console.error("[ai-short-film] resource refresh failed", cause);
    }
  };

  useEffect(() => {
    window.addEventListener("recut-sdk-ready", refresh);
    const unsubscribe = recut.events.subscribe((event) => {
      const capability = event as CapabilityEvent;
      if (capability.type === "app.capability.completed" && capability.appId === "recut.ai-short-film" && capability.kind === "operation" && ["brief.create", "resource.create", "resource.update", "research.approve", "proposal.select", "delivery.export"].includes(String(capability.name))) void refresh();
    });
    return () => { window.removeEventListener("recut-sdk-ready", refresh); unsubscribe(); };
  }, []);

  const resourcesFor = (stage: Stage) => resources.filter((resource) => resource.kind.toLowerCase() === stage.kind.toLowerCase());
  const create = async (stage: Stage, instruction: string, mentions: ContextMention[]) => {
    const prepared = await recut.background.call("resource.prepare", { kind: stage.kind, instruction, contextMentions: mentions });
    await recut.agent.compose({ prompt: prepared.prompt });
    setStatus(t(locale, "status.creationQueued"));
  };
  const startProjectBrief = async (input: ProjectBriefInput) => {
    const duration = t(locale, "brief.durationLabel", { seconds: input.expectedDurationSec });
    const prompt = t(locale, "brief.prompt", {
      topic: input.topic,
      details: input.details || t(locale, "brief.noDetails"),
      styleTemplateId: input.styleTemplateId,
      aspectRatio: input.aspectRatio,
      duration,
    });
    if (!navigator.clipboard?.writeText) throw new Error(t(locale, "brief.clipboardUnsupported"));
    await navigator.clipboard.writeText(prompt);
    await recut.agent.compose({ prompt });
    setStatus(t(locale, "status.briefCopied"));
  };
  const exportDelivery = async (input: Record<string, unknown>) => {
    const asset = await recut.background.call("delivery.export", input);
    await refresh();
    setStatus(t(locale, "status.deliveryExported"));
    return asset;
  };
  const troubleshootExport = async (message: string) => {
    try {
      await recut.agent.compose({ prompt: t(locale, "troubleshoot.prompt", { message }) });
      setStatus(t(locale, "status.troubleshootFilled"));
    } catch { setStatus(t(locale, "status.noCodexSession")); }
  };
  const approveResearch = async (resource: Resource) => {
    await recut.background.call("research.approve", { id: resource.id });
    await refresh();
    setStatus(t(locale, "status.researchApproved"));
  };
  const selectProposal = async (resource: Resource, candidateId: string) => {
    await recut.background.call("proposal.select", { id: resource.id, candidateId });
    await refresh();
    setStatus(t(locale, "status.proposalSelected"));
  };

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,oklch(0.99_0.012_151),transparent_30rem)] p-4 sm:p-6"><div className="mx-auto max-w-[1440px]">
    <header className="mb-4 flex items-end justify-between gap-6 border-b border-border/80 pb-4"><div><p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-primary">{t(locale, "header.kicker")}</p><h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">{t(locale, "header.title")}</h1><p className="mt-1 text-sm text-muted-foreground">{t(locale, "header.subtitle")}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground" data-testid="resource-diagnostic">{t(locale, "header.diagnostic", { text: diagnostic })}</p></div></header>
    <div className="grid gap-5 xl:grid-cols-2">
      <StagePanel onCreate={() => setCreatingStage(stages[0])} onPreview={setPreview} resources={resourcesFor(stages[0])} stage={stages[0]} />
      {stages.slice(1, -1).map((stage) => <StagePanel key={stage.kind} onCreate={() => setCreatingStage(stage)} onPreview={setPreview} resources={resourcesFor(stage)} stage={stage} />)}
      <StagePanel onCreate={() => setDeliveryOpen(true)} onPreview={setPreview} resources={resourcesFor(stages[stages.length - 1])} stage={stages[stages.length - 1]} />
    </div>
    {status && <p className="mt-5 text-sm text-muted-foreground" role="status">{status}</p>}
  </div>
  <ResourcePreviewDialog onApproveResearch={(resource) => void approveResearch(resource)} onOpenChange={(open) => !open && setPreview(null)} onSelectProposal={(resource, candidateId) => void selectProposal(resource, candidateId)} resource={preview} />
  <CreateResourceDialog examples={creatingStage?.kind === "Brief" ? examples : []} isBrief={creatingStage?.kind === "Brief" || projectBriefOpen} isLook={creatingStage?.kind === "Look"} onCreate={(instruction, mentions) => creatingStage ? create(creatingStage, instruction, mentions) : Promise.resolve()} onOpenChange={(open) => { if (!open) { setCreatingStage(null); setProjectBriefOpen(false); } }} onStartBrief={startProjectBrief} open={Boolean(creatingStage) || projectBriefOpen} resources={resources} stage={creatingStage?.label || t(locale, "status.briefStageFallback")} />
  <DeliveryExportDialog onExport={exportDelivery} onOpenChange={setDeliveryOpen} onTroubleshoot={troubleshootExport} open={deliveryOpen} resources={resources} />
  </main>;
}

createRoot(document.getElementById("root")!).render(<MediaAssetEventsProvider><App /></MediaAssetEventsProvider>);
