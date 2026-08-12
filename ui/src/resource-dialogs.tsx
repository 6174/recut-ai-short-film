/**
 * [INPUT]: 依赖 Resource 类型、状态感知资源展示、同级 Skill 风格参考图、lucide 图标与 shadcn 风格弹窗组件
 * [OUTPUT]: 对外提供 iframe 内受控资源详情模态框、资料确认/方案选定人工闸门与带内置风格参考图的新建资源弹窗；立项表单收集选题、风格、画幅与时长，并只构建可复制的中文任务书
 * [POS]: vox-broll 的短暂交互层；只收集本阶段的创作意图，不建立 section 间的资源依赖；立项时预览可选风格的同级 references 图片，复杂上下文由 Agent 从 workflow.context 推理
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { Resource } from "./main";
import { ResourcePresentation, resourceKindLabel } from "./resource-view";
import { ContextMentionsField, type ContextMention } from "./context-mentions";
import { StyleTemplatePicker } from "./style-references";
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Textarea } from "./ui";

export function ResourcePreviewDialog({ onApproveResearch, onOpenChange, onSelectProposal, resource }: { onApproveResearch: (resource: Resource) => void; onOpenChange: (open: boolean) => void; onSelectProposal: (resource: Resource, candidateId: string) => void; resource: Resource | null }) {
  const content = resource?.content && typeof resource.content === "object" ? resource.content as Record<string, unknown> : {};
  const candidates = Array.isArray(content.candidates) ? content.candidates as Array<{ id?: unknown; title?: unknown; logline?: unknown }> : [];
  const researchReady = resource?.kind.toLowerCase() === "research" && content.status !== "approved";
  const proposalsPending = resource?.kind.toLowerCase() === "proposals" && !content.selectedProposalId;
  return <Dialog onOpenChange={onOpenChange} open={Boolean(resource)}>{resource && <DialogContent><DialogHeader><div className="flex items-center gap-2"><Badge>{resourceKindLabel(resource.kind)}</Badge><span className="text-xs text-muted-foreground">资源详情</span></div><DialogTitle>{resource.title}</DialogTitle><DialogDescription className="sr-only">{resource.title} 的完整内容</DialogDescription></DialogHeader><ResourcePresentation resource={resource} />{proposalsPending && <section className="grid gap-2 rounded-md border bg-muted/30 p-3"><p className="text-sm font-medium">选定一个创作方案后，才会进入剧本与场景方案。</p>{candidates.map((candidate, index) => <Button key={String(candidate.id || index)} onClick={() => typeof candidate.id === "string" && onSelectProposal(resource, candidate.id)} type="button" variant="outline">选定：{typeof candidate.title === "string" ? candidate.title : `方案 ${index + 1}`}</Button>)}</section>}<DialogFooter>{researchReady && <Button onClick={() => onApproveResearch(resource)} type="button">资料足够，进入创作方案</Button>}</DialogFooter></DialogContent>}</Dialog>;
}

export type ProjectBriefInput = { topic: string; details: string; expectedDurationSec: number; aspectRatio: string; styleTemplateId: string };

export function CreateResourceDialog({ examples, isBrief, isLook, onCreate, onOpenChange, onStartBrief, open, resources, stage }: { examples: string[]; isBrief: boolean; isLook: boolean; onCreate: (instruction: string, mentions: ContextMention[]) => Promise<void>; onOpenChange: (open: boolean) => void; onStartBrief: (input: ProjectBriefInput) => Promise<void>; open: boolean; resources: Resource[]; stage: string }) {
  const [instruction, setInstruction] = useState("");
  const [mentions, setMentions] = useState<ContextMention[]>([]);
  const [topic, setTopic] = useState("");
  const [details, setDetails] = useState("");
  const [duration, setDuration] = useState("60");
  const [customDuration, setCustomDuration] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [styleTemplateId, setStyleTemplateId] = useState("editorial-vox");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!open) {
      setInstruction("");
      setMentions([]);
      setTopic("");
      setDetails("");
      setDuration("60");
      setCustomDuration("");
      setAspectRatio("16:9");
      setStyleTemplateId("editorial-vox");
      setError("");
    }
  }, [open]);
  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      if (isBrief) {
        const expectedDurationSec = Number(duration === "custom" ? customDuration : duration);
        if (!topic.trim()) throw new Error("请填写选题方向");
        if (!Number.isFinite(expectedDurationSec) || expectedDurationSec <= 0) throw new Error("请填写有效的预期视频时长");
        await onStartBrief({ topic: topic.trim(), details: details.trim(), expectedDurationSec, aspectRatio, styleTemplateId });
      } else {
        await onCreate(instruction, mentions);
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法提交创作请求");
    } finally {
      setSubmitting(false);
    }
  };
  const description = isBrief
    ? "先定义短片目标与导演风格。确认后只会生成项目任务书，复制并写入右侧 Agent 输入框；不会自动启动 Agent。"
    : isLook
      ? "Codex 将为本片生成一张包含全片视觉元素的视觉设定参考图，并把原始提示词与图片一起保存。"
      : "填写本阶段的创作意图后交给 Agent；它会从当前工作流上下文自行判断所需资料与素材。";
  return <Dialog onOpenChange={onOpenChange} open={open}><DialogContent><DialogHeader><DialogTitle>{isBrief ? "开始 AI 短片" : `新建${stage}`}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><div className="grid gap-5">{isBrief ? <><label className="grid gap-2 text-sm font-medium">选题方向<input autoFocus className="h-10 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" onChange={(event) => setTopic(event.target.value)} placeholder="例如：为什么 AI 视频工作流总卡在最后一步？" value={topic} /></label><StyleTemplatePicker onChange={setStyleTemplateId} value={styleTemplateId} /><label className="grid gap-2 text-sm font-medium">成片画幅<select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" onChange={(event) => setAspectRatio(event.target.value)} value={aspectRatio}><option value="16:9">横版 16:9</option><option value="9:16">竖版 9:16</option><option value="1:1">方形 1:1</option><option value="4:5">社交 4:5</option></select></label><label className="grid gap-2 text-sm font-medium">细节描述 <span className="font-normal text-muted-foreground">（补充）</span><Textarea onChange={(event) => setDetails(event.target.value)} placeholder="补充受众、已有素材、语气或必须避免的内容。" value={details} /></label><label className="grid gap-2 text-sm font-medium">预期视频时长<select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" onChange={(event) => setDuration(event.target.value)} value={duration}><option value="30">30 秒</option><option value="60">60 秒</option><option value="90">90 秒</option><option value="120">120 秒</option><option value="custom">自定义</option></select></label>{duration === "custom" && <label className="grid gap-2 text-sm font-medium">自定义时长（秒）<input className="h-10 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" inputMode="numeric" min="1" onChange={(event) => setCustomDuration(event.target.value)} placeholder="例如：45" type="number" value={customDuration} /></label>}<p className="rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">开始后先建立资料研究库，并由你确认资料足够；随后才提出创作方案和进入制作。</p></> : <><ContextMentionsField instruction={instruction} onChange={(nextInstruction, nextMentions) => { setInstruction(nextInstruction); setMentions(nextMentions); }} resources={resources} value={mentions} />{examples.length > 0 && <div className="flex flex-wrap gap-2">{examples.map((example) => <button className="rounded-md border bg-background px-2.5 py-1.5 text-left text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground" key={example} onClick={() => setInstruction(example)} type="button">{example}</button>)}</div>}<p className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">@ 上下文只进入这次 Agent 任务书；不会保存为 section 依赖，也不会改变工作流。</p></>}{error && <p className="text-sm text-red-600">{error}</p>}</div><DialogFooter><Button onClick={() => onOpenChange(false)} type="button" variant="outline">取消</Button><Button disabled={submitting} onClick={() => void submit()} type="button">{submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{isBrief ? "复制任务书并填入 Agent" : "交给 Codex 创建"}</Button></DialogFooter></DialogContent></Dialog>;
}
