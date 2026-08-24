/**
 * [INPUT]: 依赖 React、recut media.pick 桥接、当前 AI 短片项目资源与 lucide 图标
 * [OUTPUT]: 对外提供带 @ 当前项目条目和 @ 系统素材的临时上下文输入框及可移除引用 token
 * [POS]: ai-short-film 的一次性 Agent 上下文层；选择只进入 resource.prepare 的任务书，不写入资源、不构成 section 依赖
 * [PROTOCOL]: 变更时更新此头部，然后检查 README.md
 */
import { AtSign, Database, FolderKanban, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Resource } from "./main";
import { recut, useRecutLocale } from "./recut-sdk";
import { t } from "./i18n";

export type ContextMention = { type: "project_item"; id: string; name: string; kind: string } | { type: "system_asset"; id: string; name: string; kind: string };

function mentionKey(mention: ContextMention) { return `${mention.type}:${mention.id}`; }

function kindLabel(locale: "zh" | "en", kind: string) {
  const lookup = t(locale, `kind.${String(kind).toLowerCase()}`);
  return lookup === `kind.${String(kind).toLowerCase()}` ? kind : lookup;
}

export function ContextMentionsField({ instruction, onChange, resources, value }: { instruction: string; onChange: (instruction: string, mentions: ContextMention[]) => void; resources: Resource[]; value: ContextMention[] }) {
  const locale = useRecutLocale();
  const [pickerOpen, setPickerOpen] = useState(false);
  const query = instruction.match(/@([^\s@]*)$/)?.[1];
  const projectItems = useMemo(() => resources.filter((resource) => !value.some((mention) => mention.type === "project_item" && mention.id === resource.id) && `${resource.title} ${resource.kind} ${kindLabel(locale, resource.kind)}`.toLowerCase().includes((query || "").toLowerCase())).slice(0, 6), [query, resources, value, locale]);
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
  return <div className="grid gap-2"><label className="grid gap-2 text-sm font-medium">{t(locale, "mentions.instruction")}<textarea className="min-h-28 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring" onChange={(event) => update(event.target.value)} placeholder={t(locale, "mentions.instructionPlaceholder")} value={instruction} /></label>{value.length > 0 && <div className="flex flex-wrap gap-1.5">{value.map((mention) => <span className="inline-flex h-7 max-w-64 items-center gap-1 rounded-sm border bg-muted px-1.5 text-[11px]" key={mentionKey(mention)}>{mention.type === "project_item" ? <FolderKanban className="size-3 text-primary" /> : <Database className="size-3 text-primary" />}<span className="truncate">{mention.name}</span><button aria-label={t(locale, "mentions.remove", { name: mention.name })} className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground" onClick={() => remove(mention)} type="button"><X className="size-3" /></button></span>)}</div>}{query !== undefined && <div className="relative"><section className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-md overflow-hidden rounded-md border bg-popover shadow-lg"><header className="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium"><AtSign className="size-3.5" />{t(locale, "mentions.pickerTitle")}</header><div className="p-1.5">{projectItems.map((resource) => <button className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-muted" key={resource.id} onClick={() => addProjectItem(resource)} type="button"><FolderKanban className="size-3.5 text-primary" /><span className="min-w-0 flex-1 truncate">{resource.title}</span><span className="text-[10px] text-muted-foreground">{kindLabel(locale, resource.kind)}</span></button>)}<button className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-muted" onClick={() => void addSystemAssets()} type="button"><Database className="size-3.5 text-primary" /><span className="flex-1">{t(locale, "mentions.browseAssets")}</span><span className="text-[10px] text-muted-foreground">{t(locale, "mentions.assetKinds")}</span></button>{!projectItems.length && <p className="px-2 py-2 text-[11px] text-muted-foreground">{t(locale, "mentions.noMatch")}</p>}</div></section></div>}<div className="flex items-center gap-2 text-[11px] text-muted-foreground"><AtSign className="size-3.5" /><span>{t(locale, "mentions.footer")}</span></div></div>;
}
