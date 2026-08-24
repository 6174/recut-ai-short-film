/**
 * [INPUT]: 依赖 Resource 类型、状态感知资源展示、同级 Skill 风格参考图、lucide 图标与 shadcn 风格弹窗组件
 * [OUTPUT]: 对外提供 iframe 内受控资源详情模态框、资料确认/方案选定人工闸门与带内置风格参考图的新建资源弹窗；立项表单收集选题、风格、画幅与时长，并只构建可复制的中文任务书
 * [POS]: ai-short-film 的短暂交互层；只收集本阶段的创作意图，不建立 section 间的资源依赖；立项时预览可选风格的同级 references 图片，复杂上下文由 Agent 从 workflow.context 推理
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { Resource } from "./main";
import { ResourcePresentation, resourceKindLabel } from "./resource-view";
import { ContextMentionsField, type ContextMention } from "./context-mentions";
import { StyleTemplatePicker } from "./style-references";
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Textarea } from "./ui";
import { useRecutLocale } from "./recut-sdk";
import { t } from "./i18n";

export function ResourcePreviewDialog({ onApproveResearch, onOpenChange, onSelectProposal, resource }: { onApproveResearch: (resource: Resource) => void; onOpenChange: (open: boolean) => void; onSelectProposal: (resource: Resource, candidateId: string) => void; resource: Resource | null }) {
  const locale = useRecutLocale();
  const content = resource?.content && typeof resource.content === "object" ? resource.content as Record<string, unknown> : {};
  const candidates = Array.isArray(content.candidates) ? content.candidates as Array<{ id?: unknown; title?: unknown; logline?: unknown }> : [];
  const researchReady = resource?.kind.toLowerCase() === "research" && content.status !== "approved";
  const proposalsPending = resource?.kind.toLowerCase() === "proposals" && !content.selectedProposalId;
  return <Dialog onOpenChange={onOpenChange} open={Boolean(resource)}>{resource && <DialogContent><DialogHeader><div className="flex items-center gap-2"><Badge>{resourceKindLabel(resource.kind, locale)}</Badge><span className="text-xs text-muted-foreground">{t(locale, "dialog.resourceDetails")}</span></div><DialogTitle>{resource.title}</DialogTitle><DialogDescription className="sr-only">{t(locale, "dialog.resourceSr", { title: resource.title })}</DialogDescription></DialogHeader><ResourcePresentation resource={resource} />{proposalsPending && <section className="grid gap-2 rounded-md border bg-muted/30 p-3"><p className="text-sm font-medium">{t(locale, "dialog.proposalsHint")}</p>{candidates.map((candidate, index) => <Button key={String(candidate.id || index)} onClick={() => typeof candidate.id === "string" && onSelectProposal(resource, candidate.id)} type="button" variant="outline">{t(locale, "dialog.selectCandidate", { title: typeof candidate.title === "string" ? candidate.title : t(locale, "dialog.candidateFallback", { index: index + 1 }) })}</Button>)}</section>}<DialogFooter>{researchReady && <Button onClick={() => onApproveResearch(resource)} type="button">{t(locale, "dialog.approveResearch")}</Button>}</DialogFooter></DialogContent>}</Dialog>;
}

export type ProjectBriefInput = { topic: string; details: string; expectedDurationSec: number; aspectRatio: string; styleTemplateId: string };

export function CreateResourceDialog({ examples, isBrief, isLook, onCreate, onOpenChange, onStartBrief, open, resources, stage }: { examples: string[]; isBrief: boolean; isLook: boolean; onCreate: (instruction: string, mentions: ContextMention[]) => Promise<void>; onOpenChange: (open: boolean) => void; onStartBrief: (input: ProjectBriefInput) => Promise<void>; open: boolean; resources: Resource[]; stage: string }) {
  const locale = useRecutLocale();
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
        if (!topic.trim()) throw new Error(t(locale, "dialog.topicRequired"));
        if (!Number.isFinite(expectedDurationSec) || expectedDurationSec <= 0) throw new Error(t(locale, "dialog.durationInvalid"));
        await onStartBrief({ topic: topic.trim(), details: details.trim(), expectedDurationSec, aspectRatio, styleTemplateId });
      } else {
        await onCreate(instruction, mentions);
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(locale, "dialog.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };
  const description = isBrief
    ? t(locale, "dialog.description.brief")
    : isLook
      ? t(locale, "dialog.description.look")
      : t(locale, "dialog.description.generic");
  return <Dialog onOpenChange={onOpenChange} open={open}><DialogContent><DialogHeader><DialogTitle>{isBrief ? t(locale, "dialog.title.start") : t(locale, "dialog.title.create", { stage })}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><div className="grid gap-5">{isBrief ? <><label className="grid gap-2 text-sm font-medium">{t(locale, "brief.topic")}<input autoFocus className="h-10 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" onChange={(event) => setTopic(event.target.value)} placeholder={t(locale, "brief.topicPlaceholder")} value={topic} /></label><StyleTemplatePicker onChange={setStyleTemplateId} value={styleTemplateId} /><label className="grid gap-2 text-sm font-medium">{t(locale, "brief.aspectRatio")}<select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" onChange={(event) => setAspectRatio(event.target.value)} value={aspectRatio}><option value="16:9">{t(locale, "brief.aspect.16x9")}</option><option value="9:16">{t(locale, "brief.aspect.9x16")}</option><option value="1:1">{t(locale, "brief.aspect.1x1")}</option><option value="4:5">{t(locale, "brief.aspect.4x5")}</option></select></label><label className="grid gap-2 text-sm font-medium">{t(locale, "brief.details")}<span className="font-normal text-muted-foreground">{t(locale, "brief.detailsOptional")}</span><Textarea onChange={(event) => setDetails(event.target.value)} placeholder={t(locale, "brief.detailsPlaceholder")} value={details} /></label><label className="grid gap-2 text-sm font-medium">{t(locale, "brief.duration")}<select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" onChange={(event) => setDuration(event.target.value)} value={duration}><option value="30">{t(locale, "brief.duration.30")}</option><option value="60">{t(locale, "brief.duration.60")}</option><option value="90">{t(locale, "brief.duration.90")}</option><option value="120">{t(locale, "brief.duration.120")}</option><option value="custom">{t(locale, "brief.duration.custom")}</option></select></label>{duration === "custom" && <label className="grid gap-2 text-sm font-medium">{t(locale, "brief.customDuration")}<input className="h-10 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" inputMode="numeric" min="1" onChange={(event) => setCustomDuration(event.target.value)} placeholder={t(locale, "brief.customDurationPlaceholder")} type="number" value={customDuration} /></label>}<p className="rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">{t(locale, "brief.note")}</p></> : <><ContextMentionsField instruction={instruction} onChange={(nextInstruction, nextMentions) => { setInstruction(nextInstruction); setMentions(nextMentions); }} resources={resources} value={mentions} />{examples.length > 0 && <div className="flex flex-wrap gap-2">{examples.map((example) => <button className="rounded-md border bg-background px-2.5 py-1.5 text-left text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground" key={example} onClick={() => setInstruction(example)} type="button">{example}</button>)}</div>}<p className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">{t(locale, "dialog.mentionsNote")}</p></>}{error && <p className="text-sm text-red-600">{error}</p>}</div><DialogFooter><Button onClick={() => onOpenChange(false)} type="button" variant="outline">{t(locale, "dialog.cancel")}</Button><Button disabled={submitting} onClick={() => void submit()} type="button">{submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{isBrief ? t(locale, "dialog.submit.brief") : t(locale, "dialog.submit.create")}</Button></DialogFooter></DialogContent></Dialog>;
}
