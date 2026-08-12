/**
 * [INPUT]: 依赖 React、recut media.pick 桥接、当前 AI 短片项目资源与 lucide 图标
 * [OUTPUT]: 对外提供带 @ 当前项目条目和 @ 系统素材的临时上下文输入框及可移除引用 token
 * [POS]: vox-broll 的一次性 Agent 上下文层；选择只进入 resource.prepare 的任务书，不写入资源、不构成 section 依赖
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { AtSign, Database, FolderKanban, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Resource } from "./main";
import { recut } from "./recut-sdk";

export type ContextMention = { type: "project_item"; id: string; name: string; kind: string } | { type: "system_asset"; id: string; name: string; kind: string };

const labels: Record<string, string> = { brief: "立项", research: "资料研究", proposals: "创作方案", script: "剧本与场景方案", look: "视觉设定", keyframes: "关键画面", audio: "声音设计", scenes: "场景视频", delivery: "成片交付" };

function mentionKey(mention: ContextMention) { return `${mention.type}:${mention.id}`; }

export function ContextMentionsField({ instruction, onChange, resources, value }: { instruction: string; onChange: (instruction: string, mentions: ContextMention[]) => void; resources: Resource[]; value: ContextMention[] }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const query = instruction.match(/@([^\s@]*)$/)?.[1];
  const projectItems = useMemo(() => resources.filter((resource) => !value.some((mention) => mention.type === "project_item" && mention.id === resource.id) && `${resource.title} ${resource.kind} ${labels[resource.kind.toLowerCase()] || ""}`.toLowerCase().includes((query || "").toLowerCase())).slice(0, 6), [query, resources, value]);
  const update = (nextInstruction: string, nextMentions = value) => onChange(nextInstruction, nextMentions);
  const addProjectItem = (resource: Resource) => update(instruction.replace(/@([^\s@]*)$/, ""), [...value, { type: "project_item", id: resource.id, name: resource.title, kind: resource.kind }]);
  const addSystemAssets = async () => {
    setPickerOpen(false);
    const selection = await recut.media.pick({ kinds: ["image", "video", "audio", "transcript", "reference"], multiple: true, selectedIDs: value.filter((item) => item.type === "system_asset").map((item) => item.id) });
    const assets = Array.isArray(selection) ? selection : [selection];
    const additions = assets.filter((asset): asset is { id: string; name: string; kind: string } => Boolean(asset && typeof asset === "object" && typeof asset.id === "string" && typeof asset.name === "string")).map((asset) => ({ type: "system_asset" as const, id: asset.id, name: asset.name, kind: asset.kind }));
    update(instruction.replace(/@([^\s@]*)$/, ""), [...value, ...additions.filter((addition) => !value.some((item) => mentionKey(item) === mentionKey(addition)))]);
  };
  const remove = (mention: ContextMention) => update(instruction, value.filter((item) => mentionKey(item) !== mentionKey(mention)));
  return <div className="grid gap-2"><label className="grid gap-2 text-sm font-medium">创作要求<textarea className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" onChange={(event) => update(event.target.value)} placeholder="描述本阶段希望呈现的方向、语气或约束；输入 @ 添加当前项目条目或系统素材" value={instruction} /></label>{value.length > 0 && <div className="flex flex-wrap gap-1.5">{value.map((mention) => <span className="inline-flex h-7 max-w-64 items-center gap-1 rounded-sm border bg-muted px-1.5 text-[11px]" key={mentionKey(mention)}>{mention.type === "project_item" ? <FolderKanban className="size-3 text-primary" /> : <Database className="size-3 text-primary" />}<span className="truncate">{mention.name}</span><button aria-label={`移除 ${mention.name}`} className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground" onClick={() => remove(mention)} type="button"><X className="size-3" /></button></span>)}</div>}{query !== undefined && <div className="relative"><section className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-md overflow-hidden rounded-md border bg-popover shadow-lg"><header className="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium"><AtSign className="size-3.5" />添加上下文</header><div className="p-1.5">{projectItems.map((resource) => <button className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-muted" key={resource.id} onClick={() => addProjectItem(resource)} type="button"><FolderKanban className="size-3.5 text-primary" /><span className="min-w-0 flex-1 truncate">{resource.title}</span><span className="text-[10px] text-muted-foreground">{labels[resource.kind.toLowerCase()] || resource.kind}</span></button>)}<button className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-muted" onClick={() => void addSystemAssets()} type="button"><Database className="size-3.5 text-primary" /><span className="flex-1">浏览系统素材库</span><span className="text-[10px] text-muted-foreground">图片、视频、音频、资料</span></button>{!projectItems.length && <p className="px-2 py-2 text-[11px] text-muted-foreground">没有匹配的当前项目条目；可浏览系统素材库。</p>}</div></section></div>}<div className="flex items-center gap-2 text-[11px] text-muted-foreground"><AtSign className="size-3.5" /><span>输入 @ 添加临时上下文；不会建立资源依赖，也不会改变工作流。</span></div></div>;
}
