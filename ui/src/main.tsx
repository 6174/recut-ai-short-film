/**
 * [INPUT]: 依赖 React、recut UI SDK、共享 Asset SSE 缓存、资源卡片与资源弹窗
 * [OUTPUT]: 对外提供 B-roll 多面板工作台根视图、无资源项目的起始表单、两轨最终导出、Brief/资源创建或原位更新后的项目事件驱动资源刷新及最小通信诊断；起始表单只生成、复制并回填 5 秒节拍 Prompt，绝不提交 Agent turn，刷新后按资源 ID 同步已打开详情
 * [POS]: vox-broll 的项目 UI 编排层；同时展示全部创作阶段，为所有资源预览建立唯一 Asset SSE 缓存，最终阶段只调用 background API，不直接访问 HTTP、终端或 SQLite
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { CreateResourceDialog, type ProjectBriefInput, ResourcePreviewDialog } from "./resource-dialogs";
import { recut } from "./recut-sdk";
import { StagePanel, type Stage } from "./stage-panel";
import { DeliveryExportDialog } from "./timeline-export";
import { MediaAssetEventsProvider } from "./use-media-asset-events";
import "./style.css";

export type Resource = { id: string; kind: string; title: string; content: unknown; dependencies: string[]; createdAt?: string };
type CapabilityEvent = { type?: string; appId?: string; kind?: string; name?: string };

const stages: Stage[] = [
  { kind: "Brief", eyebrow: "第一步", label: "选题与方向", summary: "想讲什么、想让观众记住什么", action: "写创作方向", empty: "点击写下这条视频想讲什么" },
  { kind: "Beats", eyebrow: "第二步", label: "内容结构", summary: "开头怎么讲，每一段讲什么", action: "规划内容", empty: "点击规划这条视频的内容结构" },
  { kind: "Look", eyebrow: "第三步", label: "视觉参考", summary: "配图、配色和整体感觉", action: "生成参考图", empty: "点击生成视觉参考图" },
  { kind: "Keyframes", eyebrow: "第四步", label: "分镜画面", summary: "每个镜头应该长什么样", action: "添加分镜", empty: "点击添加第一张分镜画面" },
  { kind: "Audio", eyebrow: "第五步", label: "配音与音乐", summary: "先确定每段声音如何推动理解", action: "添加声音", empty: "点击添加配音或音乐" },
  { kind: "Scenes", eyebrow: "第六步", label: "场景视频", summary: "让声音和关键画面成为连续短场景", action: "生成场景视频", empty: "点击生成第一个场景视频" },
  { kind: "Delivery", eyebrow: "最后一步", label: "导出设置", summary: "尺寸、格式和导出前检查", action: "设置导出", empty: "点击设置导出格式" },
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
    void refresh();
    const unsubscribe = recut.events.subscribe((event) => {
      const capability = event as CapabilityEvent;
      if (capability.type === "app.capability.completed" && capability.appId === "recut.vox-broll" && capability.kind === "operation" && ["brief.create", "resource.create", "resource.update"].includes(String(capability.name))) void refresh();
    });
    return () => { window.removeEventListener("recut-sdk-ready", refresh); unsubscribe(); };
  }, []);

  const resourcesFor = (stage: Stage) => resources.filter((resource) => resource.kind.toLowerCase() === stage.kind.toLowerCase());
  const create = async (stage: Stage, instruction: string, dependencies: string[]) => {
    const selectedResources = resources.filter((resource) => dependencies.includes(resource.id));
    const prepared = await recut.background.call("resource.prepare", { kind: stage.kind, dependencies: selectedResources.map((item) => `${item.kind}:${item.id}`), instruction });
    await recut.agent.compose({ prompt: prepared.prompt });
    setStatus("创作请求已填入右侧 Agent 输入框；发送后资源会自动出现。 ");
  };
  const startProjectBrief = async (input: ProjectBriefInput) => {
    const prompt = `我要制作一支 Vox 风格 B-roll 解说片。\n\n项目起始信息：\n- 选题方向：${input.topic}\n- 细节描述：${input.details || "无额外补充"}\n- 预期视频时长：${input.expectedDurationSec} 秒\n\n请严格从 Brief 阶段开始：\n1. 先调用 workflow.context。\n2. 仅调用 brief.create 保存以上选题方向、细节描述和 expectedDurationSec。\n3. 说明你将如何把这个选题收敛为核心观点、目标观众与开场冲突。\n4. 到此停下，等待我确认后再进入 Beats；不要提前生成内容结构、Look、关键画面、音频或视频。\n\n后续进入 Beats 时，整支片必须按约 5 秒一个 Beat、一个 Keyframe、一个 Scene 拆分；总时长 ${input.expectedDurationSec} 秒必须由这些 5 秒节拍覆盖。Look 参考图必须包含全片会出现的主体、道具、信息卡、背景材料与层级，而非只展示色彩风格。`;
    if (!navigator.clipboard?.writeText) throw new Error("当前环境不支持自动复制，请手动复制右侧输入框中的 Prompt");
    await navigator.clipboard.writeText(prompt);
    await recut.agent.compose({ prompt });
    setStatus("Prompt 已复制，并已写入右侧 Agent 输入框；请确认后手动发送。 ");
  };
  const exportDelivery = async (input: Record<string, unknown>) => {
    const asset = await recut.background.call("delivery.export", input);
    await refresh();
    setStatus("最终视频已作为新的素材导出。");
    return asset;
  };
  const troubleshootExport = async (message: string) => {
    try {
      await recut.agent.compose({ prompt: `请只排查并修复 B-roll 最终导出失败的问题，不要重新创作视频或改动时间线。导出由平台 FFmpeg 两轨合成执行，诊断如下：${message}\n如果未安装 FFmpeg，请按本机环境安装并在完成后提示我重试；若是编码或素材问题，定位原因并修复到可以重新导出。` });
      setStatus("导出诊断已填入右侧 Agent 输入框；确认发送后它只会处理环境或导出错误，不会重做创作内容。");
    } catch { setStatus("导出失败，且当前没有可用的 Codex 会话；请创建会话后重试导出。 "); }
  };
  const retire = async (resource: Resource) => {
    if (!window.confirm(`将“${resource.title}”移出当前方案？历史记录会保留。`)) return;
    await recut.background.call("resource.retire", { id: resource.id });
    await refresh();
    setStatus("旧格式资源已移出当前方案；请新建视觉风格以生成正确的参考图。");
  };
  const remove = async (resource: Resource) => {
    if (!window.confirm(`永久删除“${resource.title}”？此操作无法撤销。`)) return;
    try {
      await recut.background.call("resource.delete", { id: resource.id });
      setPreview(null);
      await refresh();
      setStatus("资源已删除。");
    } catch (cause) { setStatus(cause instanceof Error ? cause.message : "删除资源失败"); }
  };

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,oklch(0.99_0.012_151),transparent_30rem)] p-4 sm:p-6"><div className="mx-auto max-w-[1440px]">
    <header className="mb-4 flex items-end justify-between gap-6 border-b border-border/80 pb-4"><div><p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-primary">RECUT APP / VOX B-ROLL</p><h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">视频创作台</h1><p className="mt-1 text-sm text-muted-foreground">从选题到导出，所有素材和创作决定都集中在这里。</p><p className="mt-1 font-mono text-[10px] text-muted-foreground" data-testid="resource-diagnostic">诊断 · {diagnostic}</p></div></header>
    <div className="grid gap-5 xl:grid-cols-2">
      <StagePanel onCreate={() => setCreatingStage(stages[0])} onDelete={(resource) => void remove(resource)} onPreview={setPreview} onRetire={(resource) => void retire(resource)} resources={resourcesFor(stages[0])} stage={stages[0]} />
      <StagePanel onCreate={() => setCreatingStage(stages[1])} onDelete={(resource) => void remove(resource)} onPreview={setPreview} onRetire={(resource) => void retire(resource)} resources={resourcesFor(stages[1])} stage={stages[1]} />
      <StagePanel onCreate={() => setCreatingStage(stages[2])} onDelete={(resource) => void remove(resource)} onPreview={setPreview} onRetire={(resource) => void retire(resource)} resources={resourcesFor(stages[2])} stage={stages[2]} />
      <StagePanel onCreate={() => setCreatingStage(stages[3])} onDelete={(resource) => void remove(resource)} onPreview={setPreview} onRetire={(resource) => void retire(resource)} resources={resourcesFor(stages[3])} stage={stages[3]} />
      <StagePanel onCreate={() => setCreatingStage(stages[4])} onDelete={(resource) => void remove(resource)} onPreview={setPreview} onRetire={(resource) => void retire(resource)} resources={resourcesFor(stages[4])} stage={stages[4]} />
      <StagePanel onCreate={() => setCreatingStage(stages[5])} onDelete={(resource) => void remove(resource)} onPreview={setPreview} onRetire={(resource) => void retire(resource)} resources={resourcesFor(stages[5])} stage={stages[5]} />
      <StagePanel onCreate={() => setDeliveryOpen(true)} onDelete={(resource) => void remove(resource)} onPreview={setPreview} onRetire={(resource) => void retire(resource)} resources={resourcesFor(stages[6])} stage={stages[6]} />
    </div>
    {status && <p className="mt-5 text-sm text-muted-foreground" role="status">{status}</p>}
  </div>
  <ResourcePreviewDialog onDelete={(resource) => void remove(resource)} onOpenChange={(open) => !open && setPreview(null)} resource={preview} />
  <CreateResourceDialog examples={creatingStage?.kind === "Brief" ? examples : []} isBrief={creatingStage?.kind === "Brief" || projectBriefOpen} isLook={creatingStage?.kind === "Look"} onCreate={(instruction, dependencies) => creatingStage ? create(creatingStage, instruction, dependencies) : Promise.resolve()} onOpenChange={(open) => { if (!open) { setCreatingStage(null); setProjectBriefOpen(false); } }} onStartBrief={startProjectBrief} open={Boolean(creatingStage) || projectBriefOpen} resources={resources} stage={creatingStage?.label || "选题与方向"} />
  <DeliveryExportDialog onExport={exportDelivery} onOpenChange={setDeliveryOpen} onTroubleshoot={troubleshootExport} open={deliveryOpen} resources={resources} />
  </main>;
}

createRoot(document.getElementById("root")!).render(<MediaAssetEventsProvider><App /></MediaAssetEventsProvider>);
