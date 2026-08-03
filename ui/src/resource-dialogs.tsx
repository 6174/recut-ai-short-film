/**
 * [INPUT]: 依赖 Resource 类型、recut UI SDK、状态感知视频/图片资源预览、lucide 图标与 shadcn 风格弹窗组件
 * [OUTPUT]: 对外提供 iframe 内受控资源详情模态框、删除确认入口与带真实媒体缩略图的新建资源弹窗；Brief 表单收集选题方向、细节描述与预期时长
 * [POS]: vox-broll 的短暂交互层；引用项展示真实图片、视频画面、实时/终态耗时或摘要，不承载资源列表或项目事件状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Resource } from "./main";
import { AssetImagePreview, AssetVideoPreview, ResourcePresentation, resourceImageAssetIDs, resourceKindLabel, resourceSummary, resourceVideoAssetIDs } from "./resource-view";
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Textarea } from "./ui";

export function ResourcePreviewDialog({ onDelete, onOpenChange, resource }: { onDelete: (resource: Resource) => void; onOpenChange: (open: boolean) => void; resource: Resource | null }) {
  return <Dialog onOpenChange={onOpenChange} open={Boolean(resource)}>{resource && <DialogContent><DialogHeader><div className="flex items-center gap-2"><Badge>{resourceKindLabel(resource.kind)}</Badge><span className="text-xs text-muted-foreground">资源详情</span></div><DialogTitle>{resource.title}</DialogTitle><DialogDescription className="sr-only">{resource.title} 的完整内容</DialogDescription></DialogHeader><ResourcePresentation resource={resource} /><DialogFooter><Button onClick={() => onDelete(resource)} type="button" variant="outline"><Trash2 className="size-4" />删除资源</Button></DialogFooter></DialogContent>}</Dialog>;
}

function ReferenceThumbnail({ resource }: { resource: Resource }) {
  const image = resourceImageAssetIDs(resource)[0];
  const video = resourceVideoAssetIDs(resource)[0];
  if (image) return <AssetImagePreview alt={`${resource.title} 缩略图`} assetId={image} className="aspect-video w-[68px] rounded border bg-muted" compact />;
  if (video) return <div className="aspect-video w-[68px] overflow-hidden rounded border bg-muted"><AssetVideoPreview assetId={video} title={resource.title} /></div>;
  return <div className="grid aspect-video w-[68px] place-items-center rounded border bg-muted px-1 text-center font-mono text-[10px] text-muted-foreground">{resourceKindLabel(resource.kind)}</div>;
}

function ReferenceOption({ checked, onChange, resource }: { checked: boolean; onChange: () => void; resource: Resource }) {
  return <label className="grid cursor-pointer grid-cols-[auto_68px_minmax(0,1fr)] items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"><input checked={checked} className="size-4 accent-primary" onChange={onChange} type="checkbox" /><ReferenceThumbnail resource={resource} /><span className="min-w-0"><span className="block truncate text-sm text-foreground">{resource.title}</span><span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-muted-foreground">{resourceSummary(resource)}</span></span></label>;
}

export type ProjectBriefInput = { topic: string; details: string; expectedDurationSec: number };

export function CreateResourceDialog({ examples, isBrief, isLook, onCreate, onOpenChange, onStartBrief, open, resources, stage }: { examples: string[]; isBrief: boolean; isLook: boolean; onCreate: (instruction: string, dependencies: string[]) => Promise<void>; onOpenChange: (open: boolean) => void; onStartBrief: (input: ProjectBriefInput) => Promise<void>; open: boolean; resources: Resource[]; stage: string }) {
  const [instruction, setInstruction] = useState("");
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [details, setDetails] = useState("");
  const [duration, setDuration] = useState("60");
  const [customDuration, setCustomDuration] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!open) {
      setInstruction("");
      setDependencies([]);
      setTopic("");
      setDetails("");
      setDuration("60");
      setCustomDuration("");
      setError("");
    }
  }, [open]);
  const toggle = (id: string) => setDependencies((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      if (isBrief) {
        const expectedDurationSec = Number(duration === "custom" ? customDuration : duration);
        if (!topic.trim()) throw new Error("请填写选题方向");
        if (!Number.isFinite(expectedDurationSec) || expectedDurationSec <= 0) throw new Error("请填写有效的预期视频时长");
        await onStartBrief({ topic: topic.trim(), details: details.trim(), expectedDurationSec });
      } else {
        await onCreate(instruction, dependencies);
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法提交创作请求");
    } finally {
      setSubmitting(false);
    }
  };
  const description = isBrief
    ? "先固定选题、补充信息和成片时长。确认后，Codex 会按约 5 秒一个关键画面开始规划内容。"
    : isLook
      ? "Codex 将为每个候选生成一张包含全片视觉元素的参考图，并把原始提示词与图片一起保存。"
      : "填写创作意图，选择需要引用的现有资源，然后交给右侧 Codex 完成创作。";
  return <Dialog onOpenChange={onOpenChange} open={open}><DialogContent><DialogHeader><DialogTitle>{isBrief ? "开始一个新项目" : `新建${stage}`}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><div className="grid gap-5">{isBrief ? <><label className="grid gap-2 text-sm font-medium">选题方向<input autoFocus className="h-10 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" onChange={(event) => setTopic(event.target.value)} placeholder="例如：为什么 AI 视频工作流总卡在最后一步？" value={topic} /></label><label className="grid gap-2 text-sm font-medium">细节描述 <span className="font-normal text-muted-foreground">（补充）</span><Textarea onChange={(event) => setDetails(event.target.value)} placeholder="补充受众、核心观点、已有素材、语气或必须避免的内容。" value={details} /></label><label className="grid gap-2 text-sm font-medium">预期视频时长<select className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" onChange={(event) => setDuration(event.target.value)} value={duration}><option value="30">30 秒</option><option value="60">60 秒</option><option value="90">90 秒</option><option value="120">120 秒</option><option value="custom">自定义</option></select></label>{duration === "custom" && <label className="grid gap-2 text-sm font-medium">自定义时长（秒）<input className="h-10 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" inputMode="numeric" min="1" onChange={(event) => setCustomDuration(event.target.value)} placeholder="例如：45" type="number" value={customDuration} /></label>}<p className="rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs leading-5 text-muted-foreground">后续内容会按约 5 秒一个节拍拆分。更长视频会增加关键画面，不会用一张图覆盖过长时段。</p></> : <><label className="grid gap-2 text-sm font-medium">创作要求<Textarea onChange={(event) => setInstruction(event.target.value)} placeholder={isLook ? "描述视频主题、受众及你希望探索的完整视觉世界；参考图必须包含全片主体、道具和信息元素。" : `描述这个${stage}希望呈现的方向、语气或约束`} value={instruction} /></label>{examples.length > 0 && <div className="flex flex-wrap gap-2">{examples.map((example) => <button className="rounded-md border bg-background px-2.5 py-1.5 text-left text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground" key={example} onClick={() => setInstruction(example)} type="button">{example}</button>)}</div>}<fieldset><legend className="mb-2 text-sm font-medium">引用资源 <span className="font-normal text-muted-foreground">（可选）</span></legend><div className="max-h-60 space-y-1 overflow-auto rounded-md border p-1">{resources.length ? resources.map((resource) => <ReferenceOption checked={dependencies.includes(resource.id)} key={resource.id} onChange={() => toggle(resource.id)} resource={resource} />) : <p className="px-2.5 py-3 text-sm text-muted-foreground">还没有可引用的资源。</p>}</div></fieldset></>}{error && <p className="text-sm text-red-600">{error}</p>}</div><DialogFooter><Button onClick={() => onOpenChange(false)} type="button" variant="outline">取消</Button><Button disabled={submitting} onClick={() => void submit()} type="button">{submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{isBrief ? "交给 Codex 开始" : "交给 Codex 创建"}</Button></DialogFooter></DialogContent></Dialog>;
}
